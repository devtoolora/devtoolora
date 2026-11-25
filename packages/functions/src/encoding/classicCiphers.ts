import { FunctionError } from '../errors/FunctionError';

export type ClassicCipher = 'affine' | 'atbash' | 'rail-fence' | 'rot47' | 'vigenere';
export type ClassicCipherOptions = {
  a?: number;
  b?: number;
  cipher: ClassicCipher;
  decode: boolean;
  key?: string;
  rails?: number;
};

const maxChars = 1_000_000;
const maxKey = 256;
const minRails = 2;
const maxRails = 100;

function mapLetters(text: string, map: (index: number, position: number) => number): string {
  let out = '';
  let letters = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    const upper = code >= 65 && code <= 90;
    const base = upper ? 65 : 97;

    if (!upper && !(code >= 97 && code <= 122)) {
      out += char;

      continue;
    }

    out += String.fromCharCode(base + mod(map(code - base, letters), 26));
    letters += 1;
  }

  return out;
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function vigenere(text: string, key: string | undefined, decode: boolean): string {
  const source = key ?? '';

  if (source.length < 1 || source.length > maxKey) {
    throw new FunctionError('INVALID_KEY', 'Key must be 1 to 256 letters.');
  }

  const shifts: number[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index) | 32;

    if (code < 97 || code > 122) {
      throw new FunctionError(
        'INVALID_KEY',
        `Key must contain only letters A-Z, found a different character at position ${index + 1}.`,
      );
    }

    shifts.push(code - 97);
  }

  return mapLetters(text, (letter, position) => {
    const shift = shifts[position % shifts.length] ?? 0;

    return decode ? letter - shift : letter + shift;
  });
}

function gcd(x: number, y: number): number {
  return y === 0 ? x : gcd(y, x % y);
}

function affine(
  text: string,
  a: number | undefined,
  b: number | undefined,
  decode: boolean,
): string {
  if (!Number.isInteger(a ?? 5) || !Number.isInteger(b ?? 8)) {
    throw new FunctionError('INVALID_KEY', 'The affine values a and b must be whole numbers.');
  }

  // Only the residues matter, and products of larger values would lose precision above 2^53.
  const slope = mod(a ?? 5, 26);
  const offset = mod(b ?? 8, 26);

  if (gcd(slope, 26) !== 1) {
    throw new FunctionError('INVALID_KEY', `The value a=${a ?? 5} must be coprime with 26.`);
  }

  if (!decode) {
    return mapLetters(text, (letter) => slope * letter + offset);
  }

  let inverse = 1;

  while (mod(slope * inverse, 26) !== 1) {
    inverse += 1;
  }

  return mapLetters(text, (letter) => inverse * (letter - offset));
}

function rot47(text: string): string {
  let out = '';

  for (const char of text) {
    const code = char.charCodeAt(0);

    out += code >= 33 && code <= 126 ? String.fromCharCode(33 + ((code - 33 + 47) % 94)) : char;
  }

  return out;
}

function railFence(text: string, rails: number | undefined, decode: boolean): string {
  const count = rails ?? 3;

  if (!Number.isInteger(count) || count < minRails || count > maxRails) {
    throw new FunctionError('INVALID_KEY', 'Rails must be a whole number from 2 to 100.');
  }

  const chars = [...text];
  const period = 2 * (count - 1);

  const railOf = (index: number): number => {
    const step = index % period;

    return step < count ? step : period - step;
  };

  const buckets: number[][] = Array.from({ length: count }, () => []);

  chars.forEach((_, index) => buckets[railOf(index)]?.push(index));

  const order = buckets.flat();
  const out: string[] = new Array<string>(chars.length);

  order.forEach((original, read) => {
    if (decode) {
      out[original] = chars[read] ?? '';
    } else {
      out[read] = chars[original] ?? '';
    }
  });

  return out.join('');
}

export function applyClassicCipher(text: string, options: ClassicCipherOptions): string {
  if (text.length > maxChars) {
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');
  }

  switch (options.cipher) {
    case 'affine':
      return affine(text, options.a, options.b, options.decode);
    case 'atbash':
      return mapLetters(text, (letter) => 25 - letter);
    case 'rail-fence':
      return railFence(text, options.rails, options.decode);
    case 'rot47':
      return rot47(text);
    case 'vigenere':
      return vigenere(text, options.key, options.decode);
  }
}
