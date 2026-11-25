import { dockerError } from './dockerShell';

export type DockerMount = {
  bind?: { create_host_path: boolean; selinux?: string };
  read_only?: boolean;
  source?: string;
  target: string;
  type: 'bind' | 'volume';
  volume?: { nocopy: boolean };
};

function makeMount(
  source: string | undefined,
  target: string,
  readOnly: boolean,
  longSyntax: boolean,
  selinux?: string,
  nocopy = false,
): DockerMount {
  if (!target.startsWith('/'))
    throw dockerError('Mount target must be an absolute container path.');

  const isBind = source !== undefined && /^(?:\/|\.\.?(?:\/|$)|[A-Za-z]:[\\/])/.test(source);

  if (source !== undefined && !isBind && !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(source))
    throw dockerError(
      'Use an absolute/./../ bind path or a simple named volume. Shell-expanded paths are not resolved.',
    );
  if (selinux && !isBind)
    throw dockerError('SELinux mount flags are supported only for bind mounts.');

  return {
    ...(isBind ? { bind: { create_host_path: !longSyntax, ...(selinux ? { selinux } : {}) } } : {}),
    ...(readOnly ? { read_only: true } : {}),
    ...(source === undefined ? {} : { source }),
    target,
    type: isBind ? 'bind' : 'volume',
    ...(nocopy ? { volume: { nocopy: true } } : {}),
  };
}

export function parseMount(value: string, longSyntax: boolean): DockerMount {
  return longSyntax ? parseLongMount(value) : parseShortMount(value);
}

function parseShortMount(value: string): DockerMount {
  const parts = value.split(':');

  if (/^[A-Za-z]:[\\/]/.test(value)) parts.splice(0, 2, `${parts[0]}:${parts[1]}`);
  if (parts.length > 3 || !parts.every(Boolean))
    throw dockerError('Volume syntax is [source:]absolute-target[:ro|rw|z|Z].');

  const [first = '', second, third] = parts;
  const anonymousWithFlags =
    second !== undefined &&
    third === undefined &&
    first.startsWith('/') &&
    /^(?:ro|rw|z|Z)(?:,(?:ro|rw|z|Z))*$/.test(second);
  const source = second !== undefined && !anonymousWithFlags ? first : undefined;
  const target = second !== undefined && !anonymousWithFlags ? second : first;
  const flags = (anonymousWithFlags ? second : third)?.split(',') ?? [];

  if (
    flags.some((flag) => !['ro', 'rw', 'z', 'Z'].includes(flag)) ||
    new Set(flags).size !== flags.length ||
    (flags.includes('ro') && flags.includes('rw')) ||
    (flags.includes('z') && flags.includes('Z'))
  )
    throw dockerError('Unsupported or conflicting volume flags. Supported: ro, rw, z, Z.');

  return makeMount(
    source,
    target,
    flags.includes('ro'),
    false,
    flags.find((flag) => flag === 'z' || flag === 'Z'),
  );
}

function parseLongMount(value: string): DockerMount {
  const entries = parseMountEntries(value);

  const target = assertMountEntries(entries);

  return makeMount(
    entries.source,
    target,
    entries.readonly === 'true',
    true,
    undefined,
    entries['volume-nocopy'] === 'true',
  );
}

function parseMountEntries(value: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const aliases: Record<string, string> = {
    destination: 'target',
    dst: 'target',
    ro: 'readonly',
    src: 'source',
  };

  for (const part of value.split(',')) {
    const equals = part.indexOf('=');
    const rawKey = equals < 0 ? part : part.slice(0, equals);
    const key = (Object.hasOwn(aliases, rawKey) ? aliases[rawKey] : undefined) ?? rawKey;

    if (
      !['type', 'source', 'target', 'readonly', 'volume-nocopy'].includes(key) ||
      Object.hasOwn(entries, key)
    )
      throw dockerError(
        'Unsupported or duplicate --mount option. Supported: type, source/src, target/dst/destination, readonly/ro, volume-nocopy.',
      );

    const entry = equals < 0 ? 'true' : part.slice(equals + 1);

    if (
      !entry ||
      (['readonly', 'volume-nocopy'].includes(key) && !['true', 'false'].includes(entry))
    )
      throw dockerError('Mount values must be nonempty; boolean mount flags accept true or false.');

    entries[key] = entry;
  }

  return entries;
}

function assertMountEntries(entries: Record<string, string>): string {
  if (!['bind', 'volume'].includes(entries.type ?? '') || !entries.target)
    throw dockerError('--mount requires type=bind|volume and an absolute target.');
  if (
    entries.type === 'bind' &&
    (!entries.source || !/^(?:\/|\.\.?\/|[A-Za-z]:[\\/])/.test(entries.source))
  )
    throw dockerError('A bind mount requires an absolute/./../ source path.');
  if (
    entries.type === 'volume' &&
    entries.source &&
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(entries.source)
  )
    throw dockerError('A volume mount source must be a simple named volume.');
  if (entries.type === 'bind' && entries['volume-nocopy'] !== undefined)
    throw dockerError('volume-nocopy is only supported for volume mounts.');

  return entries.target;
}
