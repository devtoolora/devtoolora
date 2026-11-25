import { base64Encode, utf8Bytes } from '../binary';
import { FunctionError } from '../errors';

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export interface TokenOptions {
  byteCount?: number;
  count: number;
  encoding?: 'hex' | 'base64' | 'base64url';
  length?: number;
  lowercase?: boolean;
  mode: 'custom' | 'bytes';
  numbers?: boolean;
  symbols?: boolean;
  uppercase?: boolean;
}

export async function hashBytes(bytes: Uint8Array, algorithm: string): Promise<string> {
  if (algorithm === 'md5') {
    return md5Hex(bytes);
  }

  const subtle = globalThis.crypto?.subtle;

  if (!subtle) throw cryptoError('Web Crypto is unavailable in this runtime.');

  return hex(
    new Uint8Array(
      await subtle.digest(webCryptoHashName(algorithm), Uint8Array.from(bytes).buffer),
    ),
  );
}

export async function hmacText(text: string, secret: string, algorithm: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw cryptoError('Web Crypto is unavailable in this runtime.');
  }

  const key = await subtle.importKey(
    'raw',
    cryptoBuffer(secret),
    { name: 'HMAC', hash: webCryptoHashName(algorithm) },
    false,
    ['sign'],
  );

  return hex(new Uint8Array(await subtle.sign('HMAC', key, cryptoBuffer(text))));
}

function webCryptoHashName(algorithm: string): string {
  if (algorithm === 'sha1') {
    return 'SHA-1';
  }

  if (algorithm === 'sha512') {
    return 'SHA-512';
  }

  if (algorithm === 'sha256') {
    return 'SHA-256';
  }

  throw cryptoError(`Unsupported hash algorithm: ${algorithm}`);
}

export function createUlid(): string {
  const timeChars: string[] = [];
  let value = Date.now();

  for (let index = 0; index < 10; index += 1) {
    timeChars.unshift(BASE32.charAt(value % 32));
    value = Math.floor(value / 32);
  }

  return `${timeChars.join('')}${[...randomBytes(16)].map((byte) => BASE32[byte % 32]).join('')}`;
}

export function scorePassword(text: string): Record<string, unknown> {
  if (text.length === 0 || text.length > 10000)
    throw cryptoError('Password must contain 1–10000 UTF-16 units.');

  const password = text;
  const length = [...password].length;
  let score = 0;
  const warnings: string[] = [];

  if (length >= 12) score += 2;
  else
    warnings.push(
      'This checklist gives two points for at least 12 code points; this is not a password policy.',
    );
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else warnings.push('Mix upper and lower case letters.');
  if (/\d/.test(password)) score += 1;
  else warnings.push('Add a number.');
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else warnings.push('Add a symbol.');
  if (/\s/.test(password) || length >= 20) score += 1;

  const commonPattern =
    /^(?:p[a4@][s5$][s5$]w[o0]rd|qw[e3]r[t7]y|[l1|][e3][t7]m[e3][i1!|]n|[a4@]dm[i1!|]n|w[e3][l1|]c[o0]m[e3]|123456)/i.test(
      password.trim(),
    );
  const repeatedPattern = /([\s\S]{1,8})\1{2,}/u.test(password);
  const allWhitespace = /^\s+$/u.test(password);

  if (commonPattern)
    warnings.push(
      'Starts with a common demonstration pattern, counting look-alike swaps such as 0 for o. This is a small bundled check, not a breach database.',
    );
  if (repeatedPattern) warnings.push('Repeated character blocks can be easy to guess.');
  if (allWhitespace) warnings.push('Whitespace-only input is highly predictable.');
  if (commonPattern || repeatedPattern || allWhitespace) score = Math.min(score, 2);

  return {
    checks: { allWhitespace, commonPattern, repeatedPattern },
    length,
    method: 'heuristic-checklist',
    notice:
      'Illustrative checklist only. No breach lookup, entropy calculation, crack-time estimate or security certification. Character-group suggestions are not mandatory password rules.',
    score,
    rating: passwordRating(score),
    warnings,
  };
}

function passwordRating(score: number): 'strong' | 'medium' | 'weak' {
  if (score >= 5) return 'strong';
  if (score >= 3) return 'medium';

  return 'weak';
}

export function randomUuid(): string {
  const bytes = randomBytes(16);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = encodeBytes(bytes, 'hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateTokens(options: TokenOptions): string[] {
  if (options.mode !== 'bytes' && options.mode !== 'custom')
    throw cryptoError('Choose custom alphabet or encoded bytes mode.');

  const count = boundedInteger(options.count, 'Count', 1, 100);

  if (options.mode === 'bytes') {
    const byteCount = boundedInteger(options.byteCount ?? 32, 'Bytes', 1, 256);
    const encoding = options.encoding ?? 'hex';

    return Array.from({ length: count }, () => encodeBytes(randomBytes(byteCount), encoding));
  }

  const length = boundedInteger(options.length ?? 32, 'Length', 1, 512);

  for (const flag of [options.lowercase, options.uppercase, options.numbers, options.symbols])
    if (flag !== undefined && typeof flag !== 'boolean')
      throw cryptoError('Character group flags must be booleans.');
  let alphabet = '';

  if (options.lowercase !== false) alphabet += 'abcdefghijklmnopqrstuvwxyz';
  if (options.uppercase !== false) alphabet += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.numbers !== false) alphabet += '0123456789';
  if (options.symbols === true) alphabet += '!@#$%^&*()-_=+[]{};:,.?';
  if (!alphabet) throw cryptoError('Enable at least one character group.');

  return Array.from({ length: count }, () => randomString(length, alphabet));
}

export function randomBytes(length: number): Uint8Array {
  boundedInteger(length, 'Random byte length', 0, 65536);
  const crypto = globalThis.crypto;

  if (!crypto?.getRandomValues) {
    throw cryptoError('Web Crypto random values are unavailable in this runtime.');
  }

  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return bytes;
}

function randomString(length: number, alphabet: string): string {
  const limit = 256 - (256 % alphabet.length);
  let output = '';

  // Reject the uneven tail so every permitted character has the same probability.
  while (output.length < length) {
    for (const byte of randomBytes(Math.max(32, length - output.length))) {
      if (byte < limit) output += alphabet[byte % alphabet.length];
      if (output.length === length) break;
    }
  }

  return output;
}

function boundedInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw cryptoError(`${label} must be an integer between ${min} and ${max}.`);
  }

  return value;
}

export function encodeBytes(bytes: Uint8Array, encoding: 'hex' | 'base64' | 'base64url'): string {
  if (encoding !== 'hex' && encoding !== 'base64' && encoding !== 'base64url')
    throw cryptoError('Choose hex, base64 or base64url encoding.');
  if (encoding === 'hex') return hex(bytes);

  const output = base64Encode(bytes);

  return encoding === 'base64url'
    ? output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : output;
}

const md5Shifts = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const md5Constants = Array.from(
  { length: 64 },
  (_value, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0,
);

type Md5State = [number, number, number, number];

function md5Hex(input: Uint8Array): string {
  const bytes = md5PaddedMessage(input);
  let state: Md5State = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from(
      { length: 16 },
      (_value, index) =>
        bytes[offset + index * 4]! |
        (bytes[offset + index * 4 + 1]! << 8) |
        (bytes[offset + index * 4 + 2]! << 16) |
        (bytes[offset + index * 4 + 3]! << 24),
    );
    const [a, b, c, d] = md5Block(state, words);

    state = [
      (state[0] + a) >>> 0,
      (state[1] + b) >>> 0,
      (state[2] + c) >>> 0,
      (state[3] + d) >>> 0,
    ];
  }

  return state
    .map((word) =>
      [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    )
    .join('');
}

function md5PaddedMessage(input: Uint8Array): Uint8Array {
  const originalLength = input.length;
  const paddedLength = (((originalLength + 8) >> 6) + 1) << 6;
  const bytes = new Uint8Array(paddedLength);

  bytes.set(input);
  bytes[originalLength] = 0x80;
  const bitLength = originalLength * 8;

  for (let index = 0; index < 8; index += 1) {
    bytes[paddedLength - 8 + index] = Math.floor(bitLength / 2 ** (8 * index)) & 0xff;
  }

  return bytes;
}

function md5Block(state: Md5State, words: number[]): Md5State {
  let [a, b, c, d] = state;

  for (let index = 0; index < 64; index += 1) {
    let f: number;
    let g: number;

    if (index < 16) {
      f = (b & c) | (~b & d);
      g = index;
    } else if (index < 32) {
      f = (d & b) | (~d & c);
      g = (5 * index + 1) % 16;
    } else if (index < 48) {
      f = b ^ c ^ d;
      g = (3 * index + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * index) % 16;
    }

    const next = d;

    d = c;
    c = b;
    b = (b + leftRotate((a + f + md5Constants[index]! + words[g]!) >>> 0, md5Shifts[index]!)) >>> 0;
    a = next;
  }

  return [a, b, c, d];
}

function leftRotate(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

function cryptoBuffer(value: string): ArrayBuffer {
  const bytes = utf8Bytes(value);

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cryptoError(message: string): FunctionError {
  return new FunctionError('CRYPTO_ERROR', message);
}
