import { mathError, required } from './shared';

const digitAlphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const basePrefixes = new Map([
  ['0b', 2],
  ['0o', 8],
  ['0x', 16],
]);

export interface BaseConversionResult {
  decimal: number | string;
  fromBase: number;
  input: string;
  output: string;
  toBase: number;
}

export const baseConversionDigitLimit: number = 10_000;

export function convertBase(
  value: string,
  fromBase: number = 10,
  toBase: number = 16,
): BaseConversionResult {
  const source = checkedBase(fromBase);
  const target = checkedBase(toBase);

  if (value.length > baseConversionDigitLimit + 3)
    throw mathError('Value exceeds 10,000 digits plus an optional sign and prefix.');

  const input = required(value, 'Value');
  const isNegative = input.startsWith('-');
  let digits = /^[+-]/.test(input) ? input.slice(1) : input;
  const prefix = digits.slice(0, 2).toLowerCase();
  const prefixBase = basePrefixes.get(prefix);

  if (prefixBase !== undefined) {
    if (source === prefixBase) digits = digits.slice(2);
    else if (!onlyLooksPrefixed(digits, source, prefixBase))
      throw mathError(
        `Prefix ${prefix} requires source base ${prefixBase}; selected base is ${source}.`,
      );
  }

  if (!digits) throw mathError('Enter at least one digit after the sign or prefix.');
  if (digits.length > baseConversionDigitLimit) throw mathError('Value exceeds 10,000 digits.');

  let integer = 0n;
  const radix = BigInt(source);

  for (const [index, character] of [...digits.toLowerCase()].entries()) {
    const digit = digitAlphabet.indexOf(character);

    if (digit < 0 || digit >= source)
      throw mathError(
        `Invalid digit ${JSON.stringify(character)} at position ${index + 1} in base ${source}. Use ${digitAlphabet.slice(0, source)}.`,
      );

    integer = integer * radix + BigInt(digit);
  }

  if (isNegative) integer = -integer;

  const isSafeNumber =
    integer >= BigInt(Number.MIN_SAFE_INTEGER) && integer <= BigInt(Number.MAX_SAFE_INTEGER);

  return {
    decimal: isSafeNumber ? Number(integer) : integer.toString(10),
    fromBase: source,
    input,
    output: integer.toString(target),
    toBase: target,
  };
}

function readsInBase(digits: string, base: number): boolean {
  const allowed = digitAlphabet.slice(0, base);

  return [...digits.toLowerCase()].every((character) => allowed.includes(character));
}

// Hex 0b or 0b1f cannot be a binary literal, so they are plain digits. 0b11 in hex could be either,
// and stays an error rather than a guess.
function onlyLooksPrefixed(digits: string, source: number, prefixBase: number): boolean {
  const rest = digits.slice(2);

  return readsInBase(digits, source) && (rest === '' || !readsInBase(rest, prefixBase));
}

function checkedBase(value: number): number {
  if (!Number.isInteger(value) || value < 2 || value > 36)
    throw mathError('Base must be an integer from 2 through 36.');

  return value;
}
