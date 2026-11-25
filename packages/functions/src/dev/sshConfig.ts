import { isDnsName, ipv4ToInt, parseIpv6 } from '../network';
import { assertSingleLine } from '../validation';
import { devError } from './shared';

export type SshConfigOptions = {
  addKeysToAgent: 'ask' | 'confirm' | 'no' | 'omit' | 'yes';
  forwardAgent: boolean;
  host: string;
  hostName: string;
  identitiesOnly: boolean;
  identityFile: string;
  localForward: string;
  port: string;
  proxyJump: string;
  serverAliveInterval: string;
  strictHostKeyChecking: 'accept-new' | 'ask' | 'omit' | 'yes';
  useKeychain: boolean;
  user: string;
};

export type SshConfig = {
  optionCount: number;
  text: string;
};

const hostLimit = 10;
const hopLimit = 8;
const forwardLimit = 10;
const identityFileLimit = 1_024;
const hostPattern = /^!?[A-Za-z0-9._*?-]+$/;
const userPattern = /^[A-Za-z0-9._@][A-Za-z0-9._@-]{0,63}$/;
const portPattern = /^[0-9]{1,5}$/;
const intervalPattern = /^[0-9]{1,6}$/;
const identityTokens = 'duilhr%';

const isIpv4 = (value: string): boolean => {
  if (/\s/.test(value)) return false;

  try {
    ipv4ToInt(value);

    return true;
  } catch {
    return false;
  }
};

const isIpv6 = (value: string): boolean => {
  if (/[\s[\]]/.test(value)) return false;

  try {
    return parseIpv6(value).zone === undefined;
  } catch {
    return false;
  }
};

const isPort = (value: string): boolean =>
  portPattern.test(value) && Number(value) >= 1 && Number(value) <= 65_535;

// An alias or hosts-file name may hold an underscore, which DNS rules alone would reject.
const isHost = (value: string): boolean => isDnsName(value.replaceAll('_', 'a')) || isIpv4(value);

function splitHostPort(value: string): { host: string; port: string } | undefined {
  if (value.startsWith('[')) {
    const close = value.indexOf(']');
    const rest = value.slice(close + 1);

    if (close < 0 || !isIpv6(value.slice(1, close))) return undefined;
    if (rest === '') return { host: value.slice(0, close + 1), port: '' };

    return rest.startsWith(':')
      ? { host: value.slice(0, close + 1), port: rest.slice(1) }
      : undefined;
  }

  const colon = value.indexOf(':');

  if (colon < 0) return { host: value, port: '' };

  return value.indexOf(':', colon + 1) < 0
    ? { host: value.slice(0, colon), port: value.slice(colon + 1) }
    : undefined;
}

function checkHostField(raw: string): string {
  assertSingleLine(raw, 'Host');
  const patterns = raw.split(/\s+/).filter((part) => part !== '');

  if (patterns.length === 0) throw devError('Host is required.');
  if (patterns.length > hostLimit) throw devError(`Host is limited to ${hostLimit} patterns.`);

  for (const pattern of patterns) {
    if (pattern === '!') throw devError('Host pattern "!" needs a name after "!".');
    if (!hostPattern.test(pattern))
      throw devError(
        `Host pattern "${pattern}" may contain only letters, digits, ".", "_", "-", "*", "?" and a leading "!".`,
      );
  }

  return patterns.join(' ');
}

function checkHostName(raw: string): string {
  assertSingleLine(raw, 'HostName');
  const name = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
  const forDns = name.replaceAll('%h', 'h');

  if (forDns.includes('%'))
    throw devError('HostName must not contain an IPv6 zone; ssh reads % as a token.');
  if (!(isHost(forDns) || isIpv6(forDns)))
    throw devError('HostName must be a DNS name, an IPv4 address or an IPv6 address.');

  return name;
}

function checkIdentityFile(path: string): string {
  assertSingleLine(path, 'IdentityFile');

  if (path.length > identityFileLimit)
    throw devError('IdentityFile is limited to 1,024 characters.');

  for (let index = path.indexOf('%'); index >= 0; index = path.indexOf('%', index + 2)) {
    const next = path[index + 1];

    if (next === undefined || !identityTokens.includes(next))
      throw devError('IdentityFile may use only the tokens %d, %u, %i, %l, %h, %r and %%.');
  }

  if (path.includes('${'))
    throw devError(
      'IdentityFile must not contain ${, which ssh expands as an environment variable.',
    );
  if (path.includes('"')) throw devError('IdentityFile must not contain a double quote.');
  if (path.endsWith('\\')) throw devError('IdentityFile must not end with a backslash.');

  // ssh's argv_split turns \\ into \ even outside quotes, so every backslash is doubled.
  const escaped = path.replaceAll('\\', '\\\\');

  return /[ #']/.test(path) ? `"${escaped}"` : escaped;
}

function checkHop(hop: string, number: number): void {
  const fail = devError(`ProxyJump hop ${number} must be [user@]host[:port].`);
  const at = hop.lastIndexOf('@');

  if (at >= 0 && !userPattern.test(hop.slice(0, at))) throw fail;

  const parsed = splitHostPort(hop.slice(at + 1));

  if (!parsed) throw fail;
  if (!(parsed.host.startsWith('[') || isHost(parsed.host))) throw fail;
  if (parsed.port !== '' && !isPort(parsed.port)) throw fail;
}

function checkProxyJump(raw: string): string {
  assertSingleLine(raw, 'ProxyJump');
  if (raw === 'none') return raw;

  const hops = raw.split(',').map((hop) => hop.trim());

  if (hops.length > hopLimit) throw devError('ProxyJump is limited to 8 hops.');

  hops.forEach((hop, index) => checkHop(hop, index + 1));

  return hops.join(',');
}

function checkForwardLine(line: string, number: number): void {
  const fail = devError(`LocalForward line ${number} must be [bind:]port host:hostport.`);
  const parts = line.split(/[ \t]+/);
  const [listen = '', target = ''] = parts;
  const colon = listen.lastIndexOf(':');
  const bind = colon < 0 ? '' : listen.slice(0, colon);
  const target2 = splitHostPort(target);

  if (parts.length !== 2 || !target2 || !isPort(target2.port)) throw fail;
  if (!(target2.host.startsWith('[') || isHost(target2.host))) throw fail;
  if (!isPort(listen.slice(colon + 1))) throw fail;
  if (colon < 0 || bind === '*') return;

  const parsedBind = splitHostPort(bind);

  if (!parsedBind || parsedBind.port !== '') throw fail;
  if (!(parsedBind.host.startsWith('[') || isHost(parsedBind.host))) throw fail;
}

function checkLocalForward(raw: string): string[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (lines.length > forwardLimit) throw devError('LocalForward is limited to 10 lines.');

  lines.forEach((line, index) => {
    assertSingleLine(line, 'LocalForward');
    checkForwardLine(line, index + 1);
  });

  return lines;
}

function checkNumber(
  value: string,
  pattern: RegExp,
  max: number,
  min: number,
  message: string,
): void {
  if (!pattern.test(value) || Number(value) < min || Number(value) > max) throw devError(message);
}

export function buildSshConfig(options: SshConfigOptions): SshConfig {
  const host = checkHostField(options.host);
  const hostName = options.hostName.trim();
  const user = options.user.trim();
  const port = options.port.trim();
  const identityFile = options.identityFile.trim();
  const proxyJump = options.proxyJump.trim();
  const interval = options.serverAliveInterval.trim();
  const lines: string[] = [];

  if (hostName !== '') lines.push(`HostName ${checkHostName(hostName)}`);

  assertSingleLine(user, 'User');

  if (user !== '') {
    if (!userPattern.test(user))
      throw devError(
        'User may contain only letters, digits, ".", "_", "@" and "-", up to 64 characters.',
      );

    lines.push(`User ${user}`);
  }

  assertSingleLine(port, 'Port');

  if (port !== '') {
    checkNumber(port, portPattern, 65_535, 1, 'Port must be a whole number from 1 to 65,535.');
    lines.push(`Port ${port}`);
  }
  if (identityFile !== '') {
    lines.push(`IdentityFile ${checkIdentityFile(identityFile)}`);
    if (options.identitiesOnly) lines.push('IdentitiesOnly yes');
  }
  if (proxyJump !== '') lines.push(`ProxyJump ${checkProxyJump(proxyJump)}`);
  if (options.forwardAgent) lines.push('ForwardAgent yes');
  if (options.addKeysToAgent !== 'omit') lines.push(`AddKeysToAgent ${options.addKeysToAgent}`);
  if (options.useKeychain) lines.push('UseKeychain yes');

  assertSingleLine(interval, 'ServerAliveInterval');

  if (interval !== '') {
    checkNumber(
      interval,
      intervalPattern,
      86_400,
      0,
      'ServerAliveInterval must be a whole number from 0 to 86,400.',
    );

    if (Number(interval) > 0) lines.push(`ServerAliveInterval ${Number(interval)}`);
  }
  if (options.strictHostKeyChecking !== 'omit')
    lines.push(`StrictHostKeyChecking ${options.strictHostKeyChecking}`);

  for (const line of checkLocalForward(options.localForward)) lines.push(`LocalForward ${line}`);

  return {
    optionCount: lines.length,
    // IgnoreUnknown only takes effect outside an inactive block, while an unknown keyword is fatal
    // in every block, so it must come before the first Host line to protect other hosts.
    text:
      [
        ...(options.useKeychain ? ['IgnoreUnknown UseKeychain'] : []),
        `Host ${host}`,
        ...lines.map((line) => `  ${line}`),
      ].join('\n') + '\n',
  };
}
