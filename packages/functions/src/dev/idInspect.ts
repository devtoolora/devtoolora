import { devError } from './shared';

export type IdEpoch = 'discord' | 'twitter' | number;
export type UuidVariant = 'Future' | 'Microsoft' | 'NCS' | 'RFC 9562';

interface IdBase {
  input: string;
  line: number;
}

export interface UuidInspection extends IdBase {
  clockSequence?: number;
  kind: 'uuid';
  node?: string;
  special?: 'max' | 'nil';
  timestamp?: string;
  uuid: string;
  variant: UuidVariant;
  version: number;
}

export interface UlidInspection extends IdBase {
  kind: 'ulid';
  randomness: string;
  timestamp: string;
}

export interface KsuidInspection extends IdBase {
  kind: 'ksuid';
  payload: string;
  timestamp: string;
}

export interface SnowflakeInspection extends IdBase {
  kind: 'snowflake';
  process: number;
  sequence: number;
  timestamp: string;
  worker: number;
}

export interface UnknownInspection extends IdBase {
  kind: 'unknown';
  reason: string;
}

export type IdInspection =
  KsuidInspection | SnowflakeInspection | UlidInspection | UnknownInspection | UuidInspection;

export const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const KSUID_EPOCH_SECONDS = 1_400_000_000;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const EPOCHS = { discord: 1_420_070_400_000, twitter: 1_288_834_974_657 };
const GREGORIAN_TO_UNIX_MS = 12_219_292_800_000n;
const MAX_DATE_MS = 8.64e15;
const MAX_LINES = 1_000;
const MAX_LINE_LENGTH = 100;
const MAX_SNOWFLAKE = 18_446_744_073_709_551_615n;
const UUID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/;

export function inspectIds(text: string, options: { epoch: IdEpoch }): IdInspection[] {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((raw, index) => ({ input: raw.trim(), line: index + 1 }))
    .filter(({ input }) => input !== '');

  if (lines.length > MAX_LINES) throw devError('ID Inspector reads up to 1,000 lines.');

  const epoch = typeof options.epoch === 'number' ? options.epoch : EPOCHS[options.epoch];

  return lines.map(({ input, line }) => inspectLine(input, line, epoch));
}

function inspectLine(input: string, line: number, epoch: number): IdInspection {
  if (input.length > MAX_LINE_LENGTH)
    return {
      input: `${input.slice(0, MAX_LINE_LENGTH)}…`,
      kind: 'unknown',
      line,
      reason: 'IDs are at most 100 characters.',
    };

  const base = { input, line };
  const uuid = unwrapUuid(input);

  if (uuid !== undefined) return { ...base, ...inspectUuid(uuid) };
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(input)) return inspectUlid(base, input.toUpperCase());
  if (/^[0-9A-Za-z]{27}$/.test(input)) return inspectKsuid(base, input);
  if (/^\d{1,20}$/.test(input)) return inspectSnowflake(base, BigInt(input), epoch);

  return { ...base, kind: 'unknown', reason: 'Not a UUID, ULID, KSUID or Snowflake ID.' };
}

function unwrapUuid(input: string): string | undefined {
  const lower = input.toLowerCase();
  const bare = unwrap(lower, 'urn:uuid:', '') ?? unwrap(lower, '{', '}') ?? lower;

  return UUID_PATTERN.test(bare) ? bare.replaceAll('-', '') : undefined;
}

function unwrap(text: string, prefix: string, suffix: string): string | undefined {
  return text.startsWith(prefix) && text.endsWith(suffix)
    ? text.slice(prefix.length, text.length - suffix.length)
    : undefined;
}

function inspectUuid(hex: string): Omit<UuidInspection, 'input' | 'line'> {
  const uuid = formatUuid(hex);
  const version = parseInt(hex.charAt(12), 16);
  const variant = uuidVariant(parseInt(hex.charAt(16), 16));
  const base = { kind: 'uuid', uuid, variant, version } as const;

  if (/^0+$/.test(hex)) return { ...base, special: 'nil' };
  if (/^f+$/.test(hex)) return { ...base, special: 'max' };
  if (variant !== 'RFC 9562') return base;

  const node = hex.slice(20).replace(/../g, '$&:').slice(0, -1);
  const clockSequence = parseInt(hex.slice(16, 20), 16) & 0x3fff;

  // The 60-bit v1 and v6 timestamps count 100 ns ticks since 1582-10-15.
  if (version === 1) {
    const ticks = BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`);

    return { ...base, clockSequence, node, timestamp: gregorianTicks(ticks) };
  }

  if (version === 6) {
    const ticks = BigInt(`0x${hex.slice(0, 12)}${hex.slice(13, 16)}`);

    return { ...base, clockSequence, node, timestamp: gregorianTicks(ticks) };
  }

  if (version === 7)
    return { ...base, timestamp: new Date(parseInt(hex.slice(0, 12), 16)).toISOString() };

  return base;
}

export function formatUuid(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function uuidVariant(nibble: number): UuidVariant {
  if (nibble < 8) return 'NCS';
  if (nibble < 12) return 'RFC 9562';

  return nibble < 14 ? 'Microsoft' : 'Future';
}

function gregorianTicks(ticks: bigint): string {
  return new Date(Number(ticks / 10_000n - GREGORIAN_TO_UNIX_MS)).toISOString();
}

function inspectUlid(base: IdBase, ulid: string): IdInspection {
  const value = [...ulid].reduce((sum, char) => sum * 32n + BigInt(CROCKFORD.indexOf(char)), 0n);
  const timestamp = value >> 80n;

  if (timestamp >= 1n << 48n)
    return { ...base, kind: 'unknown', reason: 'ULID timestamp overflows 48 bits.' };

  return {
    ...base,
    kind: 'ulid',
    randomness: (value & ((1n << 80n) - 1n)).toString(16).padStart(20, '0'),
    timestamp: new Date(Number(timestamp)).toISOString(),
  };
}

function inspectKsuid(base: IdBase, ksuid: string): IdInspection {
  const value = [...ksuid].reduce((sum, char) => sum * 62n + BigInt(BASE62.indexOf(char)), 0n);

  if (value >= 1n << 160n)
    return { ...base, kind: 'unknown', reason: 'KSUID value overflows 20 bytes.' };

  return {
    ...base,
    kind: 'ksuid',
    payload: (value & ((1n << 128n) - 1n)).toString(16).padStart(32, '0'),
    timestamp: new Date((Number(value >> 128n) + KSUID_EPOCH_SECONDS) * 1000).toISOString(),
  };
}

function inspectSnowflake(base: IdBase, id: bigint, epoch: number): IdInspection {
  if (id > MAX_SNOWFLAKE)
    return { ...base, kind: 'unknown', reason: 'Snowflake IDs are at most 18446744073709551615.' };

  const ms = Number(id >> 22n) + epoch;

  if (ms > MAX_DATE_MS)
    return {
      ...base,
      kind: 'unknown',
      reason: 'Snowflake timestamp is beyond the supported date range.',
    };

  return {
    ...base,
    kind: 'snowflake',
    process: Number((id >> 12n) & 31n),
    sequence: Number(id & 0xfffn),
    timestamp: new Date(ms).toISOString(),
    worker: Number((id >> 17n) & 31n),
  };
}
