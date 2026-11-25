import { stringify } from 'yaml';
import { type DockerMount, parseMount } from './dockerMounts';
import { dockerError, splitCommand } from './dockerShell';

export type { DockerMount } from './dockerMounts';
export type DockerComposeService = Record<
  string,
  boolean | number | string | string[] | DockerMount[]
>;
export type DockerComposeDocument = {
  networks?: Record<string, { external: boolean; name: string }>;
  services: { app: DockerComposeService };
  volumes?: Record<string, { name: string }>;
};
export type DockerComposeReport = {
  command: string[];
  compose: DockerComposeDocument;
  image: string;
  originalInput: string;
  text: string;
  warnings: string[];
};

const valueOptions: Record<string, string> = {
  '--add-host': 'extra_hosts',
  '--cap-add': 'cap_add',
  '--cap-drop': 'cap_drop',
  '--cpus': 'cpus',
  '--dns': 'dns',
  '--entrypoint': 'entrypoint',
  '--env': 'environment',
  '--env-file': 'env_file',
  '--expose': 'expose',
  '--hostname': 'hostname',
  '--label': 'labels',
  '--memory': 'mem_limit',
  '--mount': 'volumes',
  '--name': 'container_name',
  '--net': 'network',
  '--network': 'network',
  '--platform': 'platform',
  '--publish': 'ports',
  '--restart': 'restart',
  '--security-opt': 'security_opt',
  '--tmpfs': 'tmpfs',
  '--user': 'user',
  '--volume': 'volumes',
  '--workdir': 'working_dir',
};
const shortOptions: Record<string, string> = {
  e: '--env',
  h: '--hostname',
  l: '--label',
  m: '--memory',
  p: '--publish',
  u: '--user',
  v: '--volume',
  w: '--workdir',
};
const booleanOptions: Record<string, string> = {
  '--detach': 'detach',
  '--init': 'init',
  '--interactive': 'stdin_open',
  '--privileged': 'privileged',
  '--read-only': 'read_only',
  '--rm': 'rm',
  '--tty': 'tty',
};
const shortBooleans: Record<string, string> = { d: '--detach', i: '--interactive', t: '--tty' };
const listKeys: Set<string> = new Set([
  'cap_add',
  'cap_drop',
  'dns',
  'env_file',
  'environment',
  'expose',
  'extra_hosts',
  'labels',
  'ports',
  'security_opt',
  'tmpfs',
]);

function validatePorts(option: string, value: string): void {
  const portPart = value.replace(/\/(?:tcp|udp|sctp)$/, '');
  const parts = portPart.replace(/^\[[0-9a-fA-F:]+\]:/, '').split(':');

  if ((option === '--expose' && parts.length !== 1) || parts.length > 3)
    throw dockerError(
      'Unsupported port mapping. Use [host-IP:][host-port:]container-port[/tcp|udp|sctp].',
    );

  const host = parts.length === 3 ? parts[0] : undefined;

  if (host !== undefined && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host))
    throw dockerError('Use an IPv4 host address or a quoted bracketed IPv6 address.');
  if (host !== undefined && host.split('.').some((octet) => Number(octet) > 255))
    throw dockerError('Host IPv4 address octets must not exceed 255.');

  const numbers = parts.length === 3 ? parts.slice(1) : parts;

  for (const [index, port] of numbers.entries()) {
    if (!port && index === 0 && numbers.length === 2) continue;

    const range = port.split('-').map(Number);
    const [low, high] = range;

    if (
      !/^[0-9]+(?:-[0-9]+)?$/.test(port) ||
      range.some((number) => number < (index === numbers.length - 1 ? 1 : 0) || number > 65535) ||
      (low !== undefined && high !== undefined && low > high)
    )
      throw dockerError(
        'Ports must be ascending ranges or whole numbers within 1-65535 (published host port may be 0).',
      );
  }

  if (numbers.length === 2 && numbers.every((part) => part.includes('-'))) {
    const spans = numbers.map((part) => {
      const [start = 0, end = 0] = part.split('-').map(Number);

      return end - start;
    });

    if (spans[0] !== spans[1])
      throw dockerError('Published and container port ranges must have equal lengths.');
  }
}

function validateOption(option: string, value: string): void {
  if (
    option === '--restart' &&
    !/^(?:no|always|unless-stopped|on-failure(?::[0-9]+)?)$/.test(value)
  )
    throw dockerError('Restart must be no, always, unless-stopped or on-failure[:max-retries].');
  if (
    option === '--cpus' &&
    (!/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(value) ||
      !Number.isFinite(Number(value)) ||
      Number(value) <= 0)
  )
    throw dockerError('CPUs must be a positive finite decimal.');
  if (
    option === '--memory' &&
    (!/^[0-9]+(?:\.[0-9]+)?(?:[bB]|[kKmMgG][bB]?)?$/.test(value) ||
      !Number.isFinite(Number.parseFloat(value)) ||
      Number.parseFloat(value) <= 0)
  )
    throw dockerError(
      'Memory must be a positive finite amount with optional b/k/m/g or kb/mb/gb unit.',
    );
  if (option === '--env' && !/^[A-Za-z_][A-Za-z0-9_]*(?:=[\s\S]*)?$/.test(value))
    throw dockerError('Environment must be NAME or NAME=value using a conventional variable name.');
  if (option === '--name' && !/^[A-Za-z0-9][A-Za-z0-9_.-]+$/.test(value))
    throw dockerError(
      'Container name must have at least two characters, begin with an alphanumeric character and use letters, digits, _, . or -.',
    );
  if (option === '--add-host' && !/[:=]/.test(value))
    throw dockerError('Add-host must be host:ip or host=ip.');

  if (option === '--publish' || option === '--expose') validatePorts(option, value);
}

function scalarServiceValue(key: string, argument: string): number | string | string[] {
  if (key === 'cpus') return Number(argument);
  if (key === 'entrypoint') return argument === '' ? [] : [argument];

  return argument;
}

function runArgumentsStart(tokens: string[]): number {
  if (tokens[0] !== 'docker') return -1;
  if (tokens[1] === 'run') return 2;
  if (tokens[1] === 'container' && tokens[2] === 'run') return 3;

  return -1;
}

type RunOptions = {
  mounts: DockerMount[];
  network?: string;
  nextIndex: number;
  removeAfterExit: boolean;
  service: DockerComposeService;
  warnings: string[];
};

function parseRunOptions(tokens: string[], start: number): RunOptions {
  const state: RunOptions = {
    mounts: [],
    network: undefined,
    nextIndex: start,
    removeAfterExit: false,
    service: {},
    warnings: [],
  };

  for (
    let token = tokens[state.nextIndex];
    token?.startsWith('-');
    token = tokens[state.nextIndex]
  ) {
    state.nextIndex += 1;

    if (token === '--') break;

    if (/^-[dit]+$/.test(token)) {
      applyShortBooleans(token, state);

      continue;
    }

    // Docker lets a cluster of boolean flags end in one value flag, as in -dp 80:80.
    const cluster = /^-([dit]+)([ehlmpuvw][\s\S]*)$/.exec(token);

    if (cluster) applyShortBooleans(`-${cluster[1]}`, state);

    const { argument, option } = splitOption(cluster ? `-${cluster[2]}` : token);

    if (Object.hasOwn(booleanOptions, option)) applyBooleanOption(option, argument, state);
    else applyValueOption(option, argument, tokens, state);
  }

  return state;
}

function applyShortBooleans(token: string, state: RunOptions) {
  for (const flag of token.slice(1)) {
    const key = booleanOptions[shortBooleans[flag] ?? ''];

    if (key === undefined) throw dockerError(`Unsupported Docker option: -${flag}.`);

    if (key === 'detach')
      state.warnings.push(
        'Detached mode is a Compose invocation choice (up -d), not a service property.',
      );
    else state.service[key] = true;
  }
}

function splitOption(token: string): { argument: string | undefined; option: string } {
  const equals = token.indexOf('=');
  let option = equals < 0 ? token : token.slice(0, equals);
  let argument: string | undefined = equals < 0 ? undefined : token.slice(equals + 1);

  if (/^-[ehlmpuvw]/.test(token) && !token.startsWith('--')) {
    const short = token.charAt(1);
    const longOption = Object.hasOwn(shortOptions, short) ? shortOptions[short] : undefined;

    if (longOption === undefined) throw dockerError(`Unsupported Docker option: ${token}.`);

    option = longOption;
    if (token.length > 2) argument = token.slice(2);
  }

  return { argument, option };
}

function applyBooleanOption(option: string, argument: string | undefined, state: RunOptions) {
  if (argument !== undefined && argument !== 'true' && argument !== 'false')
    throw dockerError(`${option} accepts true or false.`);

  const enabled = argument !== 'false';
  const key = booleanOptions[option];

  if (key === undefined) throw dockerError(`Unsupported Docker option: ${option}.`);
  if (key === 'detach') {
    if (enabled)
      state.warnings.push(
        'Detached mode is a Compose invocation choice (up -d), not a service property.',
      );
  } else if (key === 'rm') state.removeAfterExit = enabled;
  else state.service[key] = enabled;
}

function applyValueOption(
  option: string,
  inlineArgument: string | undefined,
  tokens: string[],
  state: RunOptions,
) {
  const key = Object.hasOwn(valueOptions, option) ? valueOptions[option] : undefined;

  if (key === undefined)
    throw dockerError(
      `Unsupported Docker option: ${option}. Nothing has been silently omitted; remove it or convert it manually.`,
    );

  const argument = inlineArgument ?? tokens[state.nextIndex++];

  if (
    argument === undefined ||
    (argument === '' && option !== '--entrypoint') ||
    argument.startsWith('--')
  )
    throw dockerError(`${option} requires a value.`);

  validateOption(option, argument);

  if (key === 'volumes') state.mounts.push(parseMount(argument, option === '--mount'));
  else if (key === 'network') {
    if (state.network !== undefined)
      throw dockerError(
        'Multiple --network options are not supported. Configure multi-network attachment in Compose manually.',
      );

    state.network = argument;
  } else if (listKeys.has(key)) appendListOption(key, argument, state);
  else {
    if (Object.hasOwn(state.service, key))
      state.warnings.push(`Repeated ${option}: the last value is used.`);

    state.service[key] = scalarServiceValue(key, argument);
  }
}

function appendListOption(key: string, argument: string, state: RunOptions) {
  const previous = state.service[key];

  state.service[key] = [
    ...(Array.isArray(previous)
      ? previous.filter((entry): entry is string => typeof entry === 'string')
      : []),
    argument,
  ];

  if (key === 'environment' && !argument.includes('='))
    state.warnings.push(
      `Environment variable ${argument} is unresolved: Docker host environment and Compose environment can differ.`,
    );
}

function applyMounts(
  compose: DockerComposeDocument,
  service: DockerComposeService,
  mounts: DockerMount[],
  warnings: string[],
): void {
  if (!mounts.length) return;

  service.volumes = mounts;
  const names = [
    ...new Set(
      mounts
        .filter((mount) => mount.type === 'volume' && mount.source)
        .map((mount) => mount.source ?? ''),
    ),
  ];

  if (names.length) compose.volumes = Object.fromEntries(names.map((name) => [name, { name }]));

  warnings.push(
    'Mounts can expose or modify host data when deployed. Relative paths are resolved from the Compose file, not the original shell working directory. Named volumes retain their exact engine names.',
  );
}

function applyNetwork(
  compose: DockerComposeDocument,
  service: DockerComposeService,
  network: string | undefined,
  warnings: string[],
): void {
  if (network === undefined) return;

  if (['host', 'none', 'bridge'].includes(network) || network.startsWith('container:'))
    service.network_mode = network;
  else {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(network))
      throw dockerError(
        'Use a simple existing network name, host, none, bridge or container:<name|id>.',
      );

    service.networks = ['run-network'];
    compose.networks = { 'run-network': { external: true, name: network } };

    warnings.push(
      'The named network is external and must already exist. It is not created or inspected here.',
    );
  }

  if (network === 'host' && service.ports)
    throw dockerError(
      'Host network mode cannot be combined with published ports in Compose. Resolve the conflict before conversion.',
    );
}

export function inspectDockerRun(value: string): DockerComposeReport {
  const tokens = splitCommand(value);
  const start = runArgumentsStart(tokens);

  if (start < 0)
    throw dockerError(
      'Start with docker run or docker container run. Shell wrappers, sudo and Docker global options are not supported.',
    );

  const { mounts, network, nextIndex, removeAfterExit, service, warnings } = parseRunOptions(
    tokens,
    start,
  );
  const image = tokens[nextIndex];

  if (!image || image.startsWith('-') || !/^[A-Za-z0-9][A-Za-z0-9_.:/@-]*$/.test(image))
    throw dockerError(
      'Provide an image reference after Docker options. Registry resolution and image existence are not checked.',
    );

  service.image = image;
  const command = tokens.slice(nextIndex + 1);

  if (command.length) service.command = command;

  const compose: DockerComposeDocument = { services: { app: service } };

  applyMounts(compose, service, mounts, warnings);
  applyNetwork(compose, service, network, warnings);

  if (removeAfterExit) {
    if (service.restart && service.restart !== 'no')
      throw dockerError('--rm conflicts with a restart policy other than no.');

    warnings.push(
      '--rm has no persistent service-property equivalent. For a one-off workload, use docker compose run --rm app rather than assuming up removes it.',
    );
  }

  if (service.privileged)
    warnings.push('Privileged mode grants broad host access. Review it before deploying.');
  if (service.environment || service.env_file)
    warnings.push(
      'Environment values and exported audits may contain secrets. This tool does not redact them or read referenced files.',
    );

  warnings.push(
    'Conversion is static and does not run Docker, read files, inspect images or verify runtime compatibility. Compose lifecycle and its default project network differ from docker run. Review with docker compose config in your target environment.',
  );

  const serialized = stringify(compose, {
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
    doubleQuotedAsJSON: true,
    indent: 2,
    lineWidth: 0,
  });
  const text = serialized.replace(/\$/g, '$$$$');

  return { command, compose, image, originalInput: value, text, warnings: [...new Set(warnings)] };
}
