/** A decimal value `coefficient × 10^-scale`, kept exact as a BigInt. */
export interface ExactDecimal {
  coefficient: bigint;
  negative: boolean;
  scale: number;
}

export function binaryDecimal(
  significand: bigint,
  exponent: number,
  negative: boolean,
): ExactDecimal {
  if (exponent >= 0) return { coefficient: significand << BigInt(exponent), negative, scale: 0 };

  return { coefficient: significand * 5n ** BigInt(-exponent), negative, scale: -exponent };
}

export function decimalText({ coefficient, negative, scale }: ExactDecimal): string {
  const digits = coefficient.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, '');

  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function roundingErrorText(stored: ExactDecimal, input: ExactDecimal): string {
  const scale = Math.max(stored.scale, input.scale);
  const scaled = (value: ExactDecimal) =>
    (value.negative ? -value.coefficient : value.coefficient) * 10n ** BigInt(scale - value.scale);
  const difference = scaled(stored) - scaled(input);

  if (difference === 0n) return 'exact';

  return decimalText({
    coefficient: difference < 0n ? -difference : difference,
    negative: difference < 0n,
    scale,
  });
}

export function bitGroups(bits: bigint, width: number, exponentBits: number): string {
  const binary = bits.toString(2).padStart(width, '0');

  return `${binary[0]} ${binary.slice(1, 1 + exponentBits)} ${binary.slice(1 + exponentBits)}`;
}

export function rows(entries: Array<[string, string]>): string {
  const width = Math.max(...entries.map(([label]) => label.length)) + 2;

  return `${entries.map(([label, value]) => label.padEnd(width) + value).join('\n')}\n`;
}
