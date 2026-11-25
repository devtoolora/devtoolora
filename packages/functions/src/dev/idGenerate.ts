import { randomBytes } from '../crypto/primitives';
import { BASE62, formatUuid, KSUID_EPOCH_SECONDS } from './idInspect';
import { devError } from './shared';

export interface GenerateIdsOptions {
  alphabet: string;
  count: number;
  kind: 'ksuid' | 'nanoid' | 'uuid-v7';
  size: number;
}

type Random = (length: number) => Uint8Array;

export function generateIds(
  options: GenerateIdsOptions,
  random: Random = randomBytes,
  now: () => number = Date.now,
): string[] {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100)
    throw devError('Count must be 1-100.');

  return Array.from({ length: options.count }, factory(options, random, now));
}

function factory(options: GenerateIdsOptions, random: Random, now: () => number): () => string {
  if (options.kind === 'nanoid') return nanoIdFactory(options.alphabet, options.size, random);
  if (options.kind === 'uuid-v7') return () => uuidV7(random, now());

  return () => ksuid(random, now());
}

function nanoIdFactory(alphabet: string, size: number, random: Random): () => string {
  const chars = Array.from(alphabet);

  if (chars.length < 2 || chars.length > 256) throw devError('Alphabet needs 2-256 characters.');
  if (new Set(chars).size !== chars.length) throw devError('Alphabet characters must be unique.');
  if (!Number.isInteger(size) || size < 2 || size > 256)
    throw devError('Nano ID size must be 2-256.');

  // Mask to the next power of two and reject bytes past the alphabet, so no character is likelier.
  const mask = (2 << (31 - Math.clz32((chars.length - 1) | 1))) - 1;
  const step = Math.ceil((1.6 * mask * size) / chars.length);

  return () => {
    // Collect characters, not a string, so astral characters count once toward the size.
    const parts: string[] = [];

    while (parts.length < size) {
      for (const byte of random(step)) {
        const char = chars[byte & mask];

        if (char !== undefined && parts.length < size) parts.push(char);
      }
    }

    return parts.join('');
  };
}

function uuidV7(random: Random, timestamp: number): string {
  const bytes = Uint8Array.from(random(16));
  let rest = Math.floor(timestamp);

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = rest % 256;
    rest = Math.floor(rest / 256);
  }

  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return formatUuid(hex);
}

function ksuid(random: Random, timestamp: number): string {
  const seconds = Math.floor(timestamp / 1000) - KSUID_EPOCH_SECONDS;

  if (seconds < 0 || seconds > 0xffffffff) throw devError('The clock is outside the KSUID range.');

  let value = BigInt(seconds);

  for (const byte of random(16)) value = (value << 8n) | BigInt(byte);

  let id = '';

  for (; id.length < 27; value /= 62n) id = `${BASE62.charAt(Number(value % 62n))}${id}`;

  return id;
}
