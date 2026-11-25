import { assertSingleLine } from '../validation';
import { devError } from './shared';

export type SystemdUnitOptions = {
  description: string;
  environment: string;
  environmentFile: string;
  execStart: string;
  group: string;
  hardening: boolean;
  networkOnline: boolean;
  restart: 'always' | 'no' | 'on-abnormal' | 'on-failure';
  restartSec: number;
  scope: 'system' | 'user';
  type: 'exec' | 'forking' | 'notify' | 'oneshot' | 'simple';
  unitName: string;
  user: string;
  workingDirectory: string;
};

export type SystemdUnit = {
  environmentCount: number;
  fileName: string;
  text: string;
  warnings: string[];
};

const valueLimit = 4_096;
const descriptionLimit = 200;
const environmentLimit = 100;
const maxId = 4_294_967_294;
const shellOperators = new Set(['|', '||', '&&', ';', '>', '>>', '<', '2>&1']);
const shells = new Set(['sh', 'bash', 'dash', 'zsh']);
const shellWarning = "ExecStart is not run by a shell; wrap pipes and redirects in /bin/sh -c '…'.";

function checkValue(value: string, label: string, limit = valueLimit): void {
  assertSingleLine(value, label);

  if (value.length > limit)
    throw devError(`${label} is limited to ${limit.toLocaleString('en-US')} characters.`);
  if (value.endsWith('\\'))
    throw devError(
      `${label} must not end with a backslash; systemd would join it with the next line.`,
    );
}

const escapePercent = (value: string): string => value.replaceAll('%', '%%');

function checkUnitName(name: string): void {
  assertSingleLine(name, 'Unit name');

  if (name.endsWith('\\'))
    throw devError(
      'Unit name must not end with a backslash; systemd would join it with the next line.',
    );
  if (name.endsWith('.service'))
    throw devError('Unit name must not end in .service; it is added for you.');
  if (name.includes('@'))
    throw devError(
      'Template units (with @) are not supported; specifiers such as %i are not expanded.',
    );
  if (!/^[A-Za-z0-9:_.-]{1,200}$/.test(name))
    throw devError('Unit name must be 1-200 characters of A-Z, a-z, 0-9, ":", "_", "." and "-".');
}

// systemd.service(5): @ - : at most once each; one of + ! !! at most.
const isValidPrefix = (prefix: string): boolean =>
  ['@', '-', ':'].every((char) => prefix.split(char).length <= 2) &&
  /^(?:\+|!!?)?$/.test(prefix.replace(/[@:-]/g, ''));

function checkExecStart(raw: string): { command: string; warnings: string[] } {
  assertSingleLine(raw, 'ExecStart');
  const execStart = raw.trim();

  if (execStart === '') throw devError('ExecStart is required.');

  checkValue(execStart, 'ExecStart');
  let start = 0;

  while ('@-:+!'.includes(execStart[start] ?? '/')) start += 1;
  const prefix = execStart.slice(0, start);
  const command = execStart.slice(start);

  if (!isValidPrefix(prefix))
    throw devError(
      'ExecStart prefixes @, - and : may each appear once, together with at most one of +, ! or !!.',
    );

  if (!command.startsWith('/'))
    throw devError('ExecStart must start with an absolute path such as /usr/bin/node.');

  const tokens = command.split(/\s+/);
  const isShellRun = shells.has(tokens[0]?.split('/').pop() ?? '') && tokens[1] === '-c';
  const risky =
    !isShellRun &&
    (tokens.some((token) => shellOperators.has(token)) ||
      command.includes('$(') ||
      command.includes('`'));

  return { command: execStart, warnings: risky ? [shellWarning] : [] };
}

function checkPath(value: string, label: string, optionalFile = false): string {
  const path = value.trim();

  if (path === '') return '';

  checkValue(path, label);
  const absolute = optionalFile && path.startsWith('-') ? path.slice(1) : path;

  if (!absolute.startsWith('/'))
    throw devError(
      optionalFile
        ? `${label} must be an absolute path, optionally prefixed with - when the file may be missing.`
        : `${label} must be an absolute path such as /srv/myapp.`,
    );

  return path;
}

function checkAccount(value: string, label: string): string {
  const account = value.trim();

  if (account === '') return '';

  checkValue(account, label);
  const isName = /^[a-z_][a-z0-9_-]{0,31}$/.test(account);
  const isId = /^[0-9]{1,10}$/.test(account) && Number(account) <= maxId;

  if (!isName && !isId)
    throw devError(
      `${label} must be a name such as myapp (a-z, 0-9, _ and -, up to 32 characters) or a numeric ID up to 4,294,967,294.`,
    );

  return account;
}

function environmentLines(text: string): string[] {
  const variables = new Map<string, string>();
  const lines = text.split('\n');

  for (const [index, line] of lines.entries()) {
    const label = `Environment line ${index + 1}`;

    checkValue(line, label);
    if (line.trim() === '') continue;

    const at = line.indexOf('=');
    const key = at < 0 ? '' : line.slice(0, at);

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw devError(
        `${label} must be KEY=value with KEY made of letters, digits and _, not starting with a digit.`,
      );
    if (variables.has(key)) throw devError(`Environment variable ${key} is set twice.`);
    if (variables.size === environmentLimit)
      throw devError(`Environment is limited to ${environmentLimit} variables.`);

    variables.set(key, line.slice(at + 1));
  }

  return [...variables].map(
    ([key, value]) =>
      `Environment="${key}=${value.replace(/[\\"%]/g, (char) => (char === '%' ? '%%' : `\\${char}`))}"`,
  );
}

export function buildSystemdUnit(options: SystemdUnitOptions): SystemdUnit {
  const isSystem = options.scope === 'system';
  const description = options.description.trim();

  checkUnitName(options.unitName);
  checkValue(description, 'Description', descriptionLimit);
  const exec = checkExecStart(options.execStart);
  const workingDirectory = checkPath(options.workingDirectory, 'WorkingDirectory');
  const environmentFile = checkPath(options.environmentFile, 'EnvironmentFile', true);
  const user = isSystem ? checkAccount(options.user, 'User') : '';
  const group = isSystem ? checkAccount(options.group, 'Group') : '';
  const environment = environmentLines(options.environment);
  const writesRestartSec = options.restart !== 'no';

  if (options.type === 'oneshot' && options.restart === 'always')
    throw devError(
      'Type=oneshot cannot use Restart=always; systemd refuses to load that unit. Choose no, on-failure or on-abnormal.',
    );

  if (
    writesRestartSec &&
    !(
      Number.isInteger(options.restartSec) &&
      options.restartSec >= 0 &&
      options.restartSec <= 3_600
    )
  )
    throw devError('RestartSec must be a whole number from 0 to 3,600.');

  const unit = [
    `Description=${escapePercent(description)}`,
    // User managers do not ship network-online.target, so the lines would do nothing there.
    ...(options.networkOnline && isSystem
      ? ['Wants=network-online.target', 'After=network-online.target']
      : []),
  ];
  const service = [
    `Type=${options.type}`,
    ...(user ? [`User=${user}`] : []),
    ...(group ? [`Group=${group}`] : []),
    ...(workingDirectory ? [`WorkingDirectory=${escapePercent(workingDirectory)}`] : []),
    ...(environmentFile ? [`EnvironmentFile=${escapePercent(environmentFile)}`] : []),
    ...environment,
    `ExecStart=${escapePercent(exec.command)}`,
    `Restart=${options.restart}`,
    ...(writesRestartSec ? [`RestartSec=${options.restartSec}`] : []),
    ...(isSystem && options.hardening
      ? ['NoNewPrivileges=yes', 'PrivateTmp=yes', 'ProtectSystem=full']
      : []),
  ];
  const install = [`WantedBy=${isSystem ? 'multi-user' : 'default'}.target`];
  const text = `${[
    ['[Unit]', ...unit],
    ['[Service]', ...service],
    ['[Install]', ...install],
  ]
    .map((block) => block.join('\n'))
    .join('\n\n')}\n`;

  return {
    environmentCount: environment.length,
    fileName: `${options.unitName}.service`,
    text,
    warnings: exec.warnings,
  };
}
