export interface PortBinding {
  hostIp: string;
  hostPorts: [number, number] | null;
  protocol: 'sctp' | 'tcp' | 'udp';
}

export interface VolumeMount {
  mode: string[];
  source: string | null;
  target: string;
  warning?: string;
}

const PROTOCOLS: ReadonlySet<string> = new Set(['sctp', 'tcp', 'udp']);
const VOLUME_MODES: ReadonlySet<string> = new Set([
  'cached',
  'consistent',
  'delegated',
  'nocopy',
  'private',
  'ro',
  'rprivate',
  'rshared',
  'rslave',
  'rw',
  'shared',
  'slave',
  'z',
  'Z',
]);
const DURATION = /^(?:\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+$/;
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const BRACED_VARIABLE = /^[A-Za-z_][A-Za-z0-9_]*(?::?[-+?][\s\S]*)?$/;
const RESTART_MESSAGE = 'restart must be no, always, on-failure, on-failure:N or unless-stopped.';

const isLetter = (char: string): boolean => /^[A-Za-z_]$/.test(char);

export function isInterpolated(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '$') {
      continue;
    }

    const next = value[index + 1] ?? '';

    if (next === '$') {
      index += 1;
    } else if (next === '{' || isLetter(next)) {
      return true;
    }
  }

  return false;
}

export function hasInvalidInterpolation(value: string): boolean {
  for (let index = value.indexOf('$'); index >= 0; index = value.indexOf('$', index + 1)) {
    if (value[index + 1] === '$') {
      index += 1;
    } else if (value[index + 1] === '{') {
      let depth = 1;
      let end = index + 2;

      for (; end < value.length && depth > 0; end += 1) {
        if (value[end] === '{') {
          depth += 1;
        } else if (value[end] === '}') {
          depth -= 1;
        }
      }

      if (depth > 0 || !BRACED_VARIABLE.test(value.slice(index + 2, end - 1))) {
        return true;
      }

      index = end - 1;
    }
  }

  return false;
}

export function isDuration(value: string): boolean {
  return DURATION.test(value);
}

function parsePortNumber(text: string): number | null {
  if (text.length === 0 || text.length > 5) {
    return null;
  }

  for (const char of text) {
    if (char < '0' || char > '9') {
      return null;
    }
  }

  const port = Number(text);

  return port >= 1 && port <= 65_535 ? port : null;
}

export function parsePortRange(text: string): [number, number] | null {
  const bounds = text.split('-');

  if (bounds.length > 2) {
    return null;
  }

  const start = parsePortNumber(bounds[0] ?? '');
  const end = parsePortNumber(bounds[bounds.length - 1] ?? '');

  return start === null || end === null || start > end ? null : [start, end];
}

function isIpv4(text: string): boolean {
  const octets = text.split('.');

  return (
    octets.length === 4 &&
    octets.every(
      (octet) =>
        octet.length >= 1 && octet.length <= 3 && /^\d+$/.test(octet) && Number(octet) <= 255,
    )
  );
}

function isIpv6(text: string): boolean {
  return text.includes(':') && /^[0-9A-Fa-f:.]+$/.test(text) && text.split(':').length <= 9;
}

function readHostIp(spec: string): { hostIp: string; rest: string } | null {
  if (!spec.startsWith('[')) {
    return { hostIp: '', rest: spec };
  }

  const close = spec.indexOf(']');

  if (close < 0 || !isIpv6(spec.slice(1, close)) || spec[close + 1] !== ':') {
    return null;
  }

  return { hostIp: spec.slice(0, close + 1), rest: spec.slice(close + 2) };
}

function splitPortSpec(spec: string): { container: string; host: string; hostIp: string } | null {
  const read = readHostIp(spec);

  if (read === null) {
    return null;
  }

  const parts = read.rest.split(':');

  if (read.hostIp !== '') {
    return parts.length <= 2
      ? {
          container: parts[parts.length - 1] ?? '',
          host: parts.length === 1 ? '' : (parts[0] ?? ''),
          hostIp: read.hostIp,
        }
      : null;
  }

  if (parts.length > 3) {
    return null;
  }

  const hostIp = parts.length === 3 ? (parts[0] ?? '') : '';
  const valid = parts.length < 3 || isIpv4(hostIp);
  const host = parts.length === 1 ? '' : (parts[parts.length - 2] ?? '');

  return valid && (host !== '' || parts.length !== 2)
    ? { container: parts[parts.length - 1] ?? '', host, hostIp }
    : null;
}

export function parsePort(value: number | string): PortBinding | string {
  const error = `"${String(value)}" is not a valid port mapping.`;

  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 65_535
      ? { hostIp: '', hostPorts: null, protocol: 'tcp' }
      : error;
  }

  const slash = value.lastIndexOf('/');
  const protocol = slash < 0 ? 'tcp' : value.slice(slash + 1);
  const split = PROTOCOLS.has(protocol)
    ? splitPortSpec(slash < 0 ? value : value.slice(0, slash))
    : null;
  const container = split === null ? null : parsePortRange(split.container);
  // Host port 0 asks Docker for a free port, so there is no fixed host port to compare.
  const hostText = split === null || split.host === '0' ? '' : split.host;
  const host = hostText === '' ? null : parsePortRange(hostText);
  const sizeMatches =
    host === null ||
    container === null ||
    container[0] === container[1] ||
    host[1] - host[0] === container[1] - container[0];
  const hostMissing = hostText !== '' && host === null;

  if (split === null || container === null || hostMissing || !sizeMatches) {
    return error;
  }

  return { hostIp: split.hostIp, hostPorts: host, protocol: protocol as PortBinding['protocol'] };
}

// As in Compose, a colon after a lone letter belongs to a Windows drive, in any part.
function splitVolume(value: string): string[] {
  const parts: string[] = [];

  for (const piece of value.split(':')) {
    const last = parts.at(-1);

    if (last !== undefined && /^[A-Za-z]$/.test(last)) {
      parts[parts.length - 1] = `${last}:${piece}`;
    } else {
      parts.push(piece);
    }
  }

  return parts;
}

export function parseVolume(value: string): VolumeMount | string {
  const parts = splitVolume(value);

  if (parts.length > 3 || (parts.length > 1 && parts[0] === '')) {
    return `"${value}" is not a valid volume mapping.`;
  }

  const target = parts[parts.length === 1 ? 0 : 1] ?? '';

  // Docker Compose accepts a relative target such as a:b without resolving a as a named volume.
  if (!target.startsWith('/') && !DRIVE_PATH.test(target)) {
    return {
      mode: [],
      source: null,
      target,
      warning:
        'The volume target is not an absolute path. Docker Compose accepts it, but the container may refuse it when it starts.',
    };
  }

  const mode = parts.length === 3 ? (parts[2] ?? '').split(',') : [];
  const unknown = mode.find((entry) => !VOLUME_MODES.has(entry));

  return {
    mode,
    source: parts.length === 1 ? null : (parts[0] ?? ''),
    target,
    ...(unknown !== undefined && {
      warning: `Unknown volume mode "${unknown}". Docker Compose accepts it, but the engine may refuse it when the container starts.`,
    }),
  };
}

export function isNamedVolume(source: string): boolean {
  return (
    source !== '' && !/^[/.~$]/.test(source) && !source.includes('/') && !source.includes('\\')
  );
}

export function restartError(value: unknown): string | undefined {
  if (typeof value === 'boolean') {
    return 'restart: write "no" in quotes.';
  }

  return typeof value === 'string' ? undefined : RESTART_MESSAGE;
}

export function restartWarning(value: unknown): string | undefined {
  const known =
    typeof value !== 'string' ||
    ['no', 'always', 'on-failure', 'unless-stopped'].includes(value) ||
    /^on-failure:\d+$/.test(value);

  return known
    ? undefined
    : `${RESTART_MESSAGE} Docker Compose accepts this value, but the engine refuses it when the container starts.`;
}

export function environmentErrors(
  value: unknown,
): Array<{ index: number | string; message: string }> {
  const errors: Array<{ index: number | string; message: string }> = [];

  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => {
      if (typeof item !== 'string') {
        errors.push({ index, message: `Environment entry ${index} needs a variable name.` });
      }
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'object' && entry !== null) {
        errors.push({
          index: key,
          message: `Environment value for ${key} must be a string, number, boolean or null.`,
        });
      }
    }
  }

  return errors;
}
