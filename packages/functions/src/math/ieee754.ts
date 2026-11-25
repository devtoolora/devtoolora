import {
  binaryDecimal,
  bitGroups,
  decimalText,
  roundingErrorText,
  rows,
  type ExactDecimal,
} from './ieee754Format';
import { mathError, required } from './shared';

export type FloatFormat = 'binary16' | 'binary32' | 'binary64';

export interface FloatInspection {
  bits: bigint;
  className: string;
  hex: string;
  shortest: string;
  text: string;
}

interface FloatSpec {
  bias: number;
  exponentBits: number;
  fractionBits: number;
  name: FloatFormat;
  width: number;
}

interface FloatParts {
  biased: number;
  fraction: bigint;
  negative: boolean;
}

type FloatInput =
  | { bits: bigint; kind: 'bits' }
  | { kind: 'decimal'; value: ExactDecimal }
  | { kind: 'infinity' | 'nan'; negative: boolean };

const specs: Record<FloatFormat, FloatSpec> = {
  binary16: { bias: 15, exponentBits: 5, fractionBits: 10, name: 'binary16', width: 16 },
  binary32: { bias: 127, exponentBits: 8, fractionBits: 23, name: 'binary32', width: 32 },
  binary64: { bias: 1023, exponentBits: 11, fractionBits: 52, name: 'binary64', width: 64 },
};

export function inspectFloat(value: string, format: FloatFormat): FloatInspection {
  const spec = specs[format];
  const input = parseFloatInput(value, spec);
  const bits = encode(input, spec);
  const parts = decompose(bits, spec);
  const className = classify(parts, spec);
  const hex = `0x${bits.toString(16).padStart(spec.width / 4, '0')}`;
  const shortest = shortestText(bits, spec);
  const unbiased = parts.biased === 0 ? 1 - spec.bias : parts.biased - spec.bias;
  const stored = storedDecimal(parts, spec);
  const entries: Array<[string, string]> = [
    ['Hex', hex],
    ['Binary', bitGroups(bits, spec.width, spec.exponentBits)],
    ['Sign', parts.negative ? '1 (negative)' : '0 (positive)'],
    ['Exponent', `${parts.biased} (unbiased ${unbiased})`],
    [
      'Fraction',
      `0x${parts.fraction.toString(16).padStart(Math.ceil(spec.fractionBits / 4), '0')}`,
    ],
    ['Class', className],
    ['Stored value', stored ? decimalText(stored) : shortest],
    ['Shortest', shortest],
  ];

  if (input.kind === 'decimal' && stored)
    entries.push(['Rounding error', roundingErrorText(stored, input.value)]);

  entries.push(
    ['Next up', shortestText(nextUp(bits, spec), spec)],
    ['Next down', shortestText(flipSign(nextUp(flipSign(bits, spec), spec), spec), spec)],
  );

  return { bits, className, hex, shortest, text: rows(entries) };
}

function parseFloatInput(value: string, spec: FloatSpec): FloatInput {
  if (value.length > 1_000) throw mathError('Value exceeds 1,000 characters.');

  const input = required(value, 'Value').toLowerCase();

  if (input.startsWith('0x')) return { bits: hexBits(input, spec), kind: 'bits' };

  const special = /^([+-]?)(inf|infinity|nan)$/.exec(input);

  if (special)
    return { kind: special[2] === 'nan' ? 'nan' : 'infinity', negative: special[1] === '-' };

  const decimal = decimalOf(input);

  if (!decimal)
    throw mathError('Enter a decimal number such as 0.1 or 1e-3, inf, nan or a 0x bit pattern.');

  return { kind: 'decimal', value: decimal };
}

function hexBits(input: string, spec: FloatSpec): bigint {
  const digits = spec.width / 4;

  if (!new RegExp(`^0x[0-9a-f]{${digits}}$`).test(input))
    throw mathError(`A ${spec.name} bit pattern is 0x followed by exactly ${digits} hex digits.`);

  return BigInt(input);
}

function decimalOf(text: string): ExactDecimal | undefined {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/.exec(text);

  if (!match) return undefined;

  const [, sign, whole, fraction = '', exponentText = '0'] = match;

  if (!whole && !fraction) return undefined;

  const exponent = Number(exponentText);

  if (Math.abs(exponent) > 10_000)
    throw mathError('Decimal exponent must be within -10,000 to 10,000.');

  const coefficient = BigInt(whole + fraction);
  const scale = fraction.length - exponent;
  const negative = sign === '-';

  if (scale >= 0) return { coefficient, negative, scale };

  return { coefficient: coefficient * 10n ** BigInt(-scale), negative, scale: 0 };
}

function encode(input: FloatInput, spec: FloatSpec): bigint {
  if (input.kind === 'bits') return input.bits;
  if (input.kind === 'decimal') return roundDecimal(input.value, spec);

  const sign = input.negative ? signBit(spec) : 0n;
  const quietBit = input.kind === 'nan' ? 1n << BigInt(spec.fractionBits - 1) : 0n;

  return sign | infinityBits(spec) | quietBit;
}

function roundDecimal({ coefficient, negative, scale }: ExactDecimal, spec: FloatSpec): bigint {
  const sign = negative ? signBit(spec) : 0n;

  if (coefficient === 0n) return sign;

  const denominator = 10n ** BigInt(scale);
  let k = bitLength(coefficient) - bitLength(denominator);

  if (k >= 0 ? coefficient < denominator << BigInt(k) : coefficient << BigInt(-k) < denominator)
    k -= 1;

  let exponent = Math.max(k, 1 - spec.bias);
  const shift = spec.fractionBits - exponent;
  const numerator = shift >= 0 ? coefficient << BigInt(shift) : coefficient;
  const divisor = shift >= 0 ? denominator : denominator << BigInt(-shift);
  let significand = numerator / divisor;
  const twiceRemainder = (numerator % divisor) * 2n;

  if (twiceRemainder > divisor || (twiceRemainder === divisor && (significand & 1n) === 1n))
    significand += 1n;

  if (significand === 1n << BigInt(spec.fractionBits + 1)) {
    significand >>= 1n;
    exponent += 1;
  }

  if (exponent > spec.bias) return sign | infinityBits(spec);

  const hidden = 1n << BigInt(spec.fractionBits);

  if (significand < hidden) return sign | significand;

  return (
    sign | (BigInt(exponent + spec.bias) << BigInt(spec.fractionBits)) | (significand - hidden)
  );
}

function bitLength(value: bigint): number {
  return value.toString(2).length;
}

function signBit(spec: FloatSpec): bigint {
  return 1n << BigInt(spec.width - 1);
}

function infinityBits(spec: FloatSpec): bigint {
  return ((1n << BigInt(spec.exponentBits)) - 1n) << BigInt(spec.fractionBits);
}

function flipSign(bits: bigint, spec: FloatSpec): bigint {
  return bits ^ signBit(spec);
}

function decompose(bits: bigint, spec: FloatSpec): FloatParts {
  return {
    biased: Number((bits >> BigInt(spec.fractionBits)) & ((1n << BigInt(spec.exponentBits)) - 1n)),
    fraction: bits & ((1n << BigInt(spec.fractionBits)) - 1n),
    negative: (bits & signBit(spec)) !== 0n,
  };
}

function classify({ biased, fraction }: FloatParts, spec: FloatSpec): string {
  if (biased === 2 ** spec.exponentBits - 1) {
    if (fraction === 0n) return 'infinity';

    return fraction >> BigInt(spec.fractionBits - 1) === 1n ? 'quiet NaN' : 'signaling NaN';
  }

  if (biased === 0) return fraction === 0n ? 'zero' : 'subnormal';

  return 'normal';
}

function finiteParts(
  { biased, fraction }: FloatParts,
  spec: FloatSpec,
): [bigint, number] | undefined {
  if (biased === 2 ** spec.exponentBits - 1) return undefined;
  if (biased === 0) return [fraction, 1 - spec.bias - spec.fractionBits];

  return [fraction | (1n << BigInt(spec.fractionBits)), biased - spec.bias - spec.fractionBits];
}

function storedDecimal(parts: FloatParts, spec: FloatSpec): ExactDecimal | undefined {
  const finite = finiteParts(parts, spec);

  return finite && binaryDecimal(finite[0], finite[1], parts.negative);
}

function toNumber(bits: bigint, spec: FloatSpec): number {
  const parts = decompose(bits, spec);
  const finite = finiteParts(parts, spec);
  const sign = parts.negative ? -1 : 1;

  if (!finite) return parts.fraction === 0n ? sign * Infinity : NaN;

  return sign * Number(finite[0]) * 2 ** finite[1];
}

function shortestText(bits: bigint, spec: FloatSpec): string {
  const value = toNumber(bits, spec);

  if (Object.is(value, -0)) return '-0';
  if (spec.width === 64 || !Number.isFinite(value)) return String(value);

  for (let precision = 1; precision <= 17; precision += 1) {
    const match = roundTripCandidate(value, precision, bits, spec);

    if (match) return match;
  }

  // Unreachable for binary16/32: 5 and 9 significant digits always round-trip.
  return String(value);
}

function roundTripCandidate(
  value: number,
  precision: number,
  bits: bigint,
  spec: FloatSpec,
): string | undefined {
  const [mantissa = '0', exponent = '0'] = Math.abs(value)
    .toExponential(precision - 1)
    .split('e');
  const digits = BigInt(mantissa.replace('.', ''));
  const sign = value < 0 ? '-' : '';

  for (const candidate of [digits, digits + 1n, digits - 1n]) {
    const text = `${sign}${candidate}e${Number(exponent) - precision + 1}`;
    const decimal = decimalOf(text);

    if (decimal && roundDecimal(decimal, spec) === bits) return String(Number(text));
  }

  return undefined;
}

function nextUp(bits: bigint, spec: FloatSpec): bigint {
  const magnitude = bits & (signBit(spec) - 1n);
  const infinity = infinityBits(spec);

  if (magnitude > infinity || bits === infinity) return bits;
  if (magnitude === 0n) return 1n;

  return magnitude === bits ? bits + 1n : bits - 1n;
}
