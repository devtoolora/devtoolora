import { utf8Bytes } from '../binary';
import { FunctionError } from '../errors';

export type BaseNAlphabet = 'ascii85' | 'base32' | 'base32hex' | 'base45' | 'base58';

const maxUnits = 1_000_000;
const maxBase58Bytes = 10_000;
const maxBase58Characters = 14_000;
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32hexAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
const base45Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const names: Record<BaseNAlphabet, string> = {
  ascii85: 'Ascii85',
  base32: 'Base32',
  base32hex: 'Base32hex',
  base45: 'Base45',
  base58: 'Base58',
};

function invalidCharacter(name: string, text: string, index: number): FunctionError {
  const character = String.fromCodePoint(text.codePointAt(index) ?? 0);

  return new FunctionError(
    'INVALID_BASE_N',
    `Invalid ${name} character "${character}" at position ${index + 1}.`,
  );
}

function invalidLength(name: string): FunctionError {
  return new FunctionError('INVALID_BASE_N', `${name} text has an invalid length.`);
}

type ScanOptions = { end?: number; ignoreCase: boolean; skipSpace: boolean; start?: number };

function scan(text: string, name: string, alphabet: string, options: ScanOptions): number[] {
  const values: number[] = [];

  for (let index = options.start ?? 0; index < (options.end ?? text.length); index++) {
    const character = text[index]!;

    if (options.skipSpace && /\s/.test(character)) continue;

    const value = alphabet.indexOf(options.ignoreCase ? character.toUpperCase() : character);

    if (value === -1) throw invalidCharacter(name, text, index);

    values.push(value);
  }

  return values;
}

function encodeBase32(bytes: Uint8Array, alphabet: string): string {
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xfff;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += alphabet[(buffer >> bits) & 31];
    }
  }

  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];

  return output.padEnd(Math.ceil(output.length / 8) * 8, '=');
}

function decodeBase32(text: string, alphabet: string, name: string): Uint8Array {
  let end = text.length;

  while (end > 0 && /[=\s]/.test(text[end - 1]!)) end--;

  const values = scan(text, name, alphabet, { end, ignoreCase: true, skipSpace: true });

  if ([1, 3, 6].includes(values.length % 8)) throw invalidLength(name);

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const value of values) {
    buffer = ((buffer << 5) | value) & 0xfff;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }

  return Uint8Array.from(bytes);
}

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length > maxBase58Bytes)
    throw new FunctionError('INPUT_TOO_LARGE', 'Base58 input is limited to 10,000 bytes.');

  const digits: number[] = [];

  for (const byte of bytes) {
    let carry = byte;

    for (let index = 0; index < digits.length; index++) {
      carry += digits[index]! * 256;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }

    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  const zeros = bytes.findIndex((byte) => byte !== 0);

  return (
    '1'.repeat(zeros === -1 ? bytes.length : zeros) +
    digits
      .reverse()
      .map((digit) => base58Alphabet[digit])
      .join('')
  );
}

function decodeBase58(text: string): Uint8Array {
  if (text.length > maxBase58Characters)
    throw new FunctionError('INPUT_TOO_LARGE', 'Base58 input is limited to 14,000 characters.');

  const values = scan(text, 'Base58', base58Alphabet, { ignoreCase: false, skipSpace: true });
  const bytes: number[] = [];

  for (const value of values) {
    let carry = value;

    for (let index = 0; index < bytes.length; index++) {
      carry += bytes[index]! * 58;
      bytes[index] = carry & 255;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }

  const zeros = values.findIndex((value) => value !== 0);

  return Uint8Array.from([
    ...new Array<number>(zeros === -1 ? values.length : zeros).fill(0),
    ...bytes.reverse(),
  ]);
}

function encodeBase45(bytes: Uint8Array): string {
  let output = '';

  for (let index = 0; index < bytes.length; index += 2) {
    const pair = index + 1 < bytes.length;
    const value = pair ? bytes[index]! * 256 + bytes[index + 1]! : bytes[index]!;

    output +=
      base45Alphabet.charAt(value % 45) + base45Alphabet.charAt(Math.floor(value / 45) % 45);

    if (pair) output += base45Alphabet[Math.floor(value / 2025)];
  }

  return output;
}

// Space is a Base45 character, so only a trailing line break is stripped.
function decodeBase45(input: string): Uint8Array {
  const text = input.replace(/(?<![\r\n])[\r\n]+$/, '');
  const values = scan(text, 'Base45', base45Alphabet, { ignoreCase: false, skipSpace: false });

  if (text.length % 3 === 1) throw invalidLength('Base45');

  const bytes: number[] = [];

  for (let index = 0; index < values.length; index += 3) {
    const [low, middle, high] = values.slice(index, index + 3);

    if (low === undefined || middle === undefined) throw invalidLength('Base45');

    const value = low + middle * 45 + (high ?? 0) * 2025;
    const limit = high === undefined ? 255 : 65535;

    if (value > limit)
      throw new FunctionError(
        'INVALID_BASE_N',
        `Base45 group "${text.slice(index, index + 3)}" is out of range.`,
      );

    if (high === undefined) bytes.push(value);
    else bytes.push(value >> 8, value & 255);
  }

  return Uint8Array.from(bytes);
}

function encodeAscii85(bytes: Uint8Array): string {
  let output = '';

  for (let index = 0; index < bytes.length; index += 4) {
    const chunk = bytes.subarray(index, index + 4);
    let value = 0;

    for (let offset = 0; offset < 4; offset++) value = value * 256 + (chunk[offset] ?? 0);

    if (chunk.length === 4 && value === 0) {
      output += 'z';

      continue;
    }

    const digits: string[] = [];

    for (let digit = 0; digit < 5; digit++) {
      digits.unshift(String.fromCharCode(33 + (value % 85)));
      value = Math.floor(value / 85);
    }

    output += digits.slice(0, chunk.length + 1).join('');
  }

  return output;
}

function flushAscii85(group: number[], bytes: number[]): void {
  const padded = [...group];

  while (padded.length < 5) padded.push(84);

  const value = padded.reduce((total, digit) => total * 85 + digit, 0);

  if (value > 0xffffffff)
    throw new FunctionError('INVALID_BASE_N', 'Ascii85 group is out of range.');

  const word = [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];

  bytes.push(...word.slice(0, group.length - 1));
}

function decodeAscii85(text: string): Uint8Array {
  let start = text.search(/\S/);
  let end = text.trimEnd().length;

  if (start === -1) return new Uint8Array();

  if (text.startsWith('<~', start)) start += 2;

  if (end - start >= 2 && text.slice(start, end).endsWith('~>')) end -= 2;

  const bytes: number[] = [];
  let group: number[] = [];

  for (let index = start; index < end; index++) {
    const character = text[index]!;

    if (/\s/.test(character)) continue;

    if (character === 'z' && group.length === 0) {
      bytes.push(0, 0, 0, 0);

      continue;
    }

    const digit = character.charCodeAt(0) - 33;

    if (digit < 0 || digit > 84) throw invalidCharacter('Ascii85', text, index);

    group.push(digit);

    if (group.length === 5) {
      flushAscii85(group, bytes);
      group = [];
    }
  }

  if (group.length === 1) throw invalidLength('Ascii85');

  if (group.length > 0) flushAscii85(group, bytes);

  return Uint8Array.from(bytes);
}

export function encodeBaseN(bytes: Uint8Array, alphabet: BaseNAlphabet): string {
  if (bytes.length > maxUnits)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 bytes.');

  if (alphabet === 'ascii85') return encodeAscii85(bytes);
  if (alphabet === 'base32') return encodeBase32(bytes, base32Alphabet);
  if (alphabet === 'base32hex') return encodeBase32(bytes, base32hexAlphabet);
  if (alphabet === 'base45') return encodeBase45(bytes);

  return encodeBase58(bytes);
}

export function decodeBaseN(text: string, alphabet: BaseNAlphabet): Uint8Array {
  if (text.length > maxUnits)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 UTF-16 units.');

  if (alphabet === 'ascii85') return decodeAscii85(text);
  if (alphabet === 'base32') return decodeBase32(text, base32Alphabet, names.base32);
  if (alphabet === 'base32hex') return decodeBase32(text, base32hexAlphabet, names.base32hex);
  if (alphabet === 'base45') return decodeBase45(text);

  return decodeBase58(text);
}

export function encodeBaseNText(text: string, alphabet: BaseNAlphabet): string {
  return encodeBaseN(utf8Bytes(text), alphabet);
}

export function decodeBaseNText(text: string, alphabet: BaseNAlphabet): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      decodeBaseN(text, alphabet),
    );
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw new FunctionError('INVALID_UTF8', 'Decoded bytes are not valid UTF-8 text.');
  }
}
