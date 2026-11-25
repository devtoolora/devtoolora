import { FunctionError } from '../errors';
import { nonBlankLines } from './lineInput';
import { randomBytes } from '../crypto/primitives';

export type CardBrand =
  | 'amex'
  | 'diners'
  | 'discover'
  | 'jcb'
  | 'maestro'
  | 'mastercard'
  | 'unionpay'
  | 'unknown'
  | 'visa';

export const cardBrands: readonly Exclude<CardBrand, 'unknown'>[] = [
  'visa',
  'mastercard',
  'amex',
  'discover',
  'diners',
  'jcb',
  'unionpay',
  'maestro',
];

const brandLabels: Record<CardBrand, string> = {
  amex: 'American Express',
  diners: 'Diners Club',
  discover: 'Discover',
  jcb: 'JCB',
  maestro: 'Maestro',
  mastercard: 'Mastercard',
  unionpay: 'UnionPay',
  unknown: 'Unknown',
  visa: 'Visa',
};

export function cardBrandLabel(brand: CardBrand): string {
  return brandLabels[brand];
}

interface BrandRule {
  brand: Exclude<CardBrand, 'unknown'>;
  generateLength: number;
  generatePrefix: string;
  lengths: (length: number) => boolean;
  matches: (digits: string) => boolean;
}

const inRange = (digits: string, size: number, from: number, to: number): boolean => {
  const prefix = Number(digits.slice(0, size));

  return prefix >= from && prefix <= to;
};

const anyOf = (...tests: ((digits: string) => boolean)[]) => {
  return (digits: string) => tests.some((test) => test(digits));
};

const starts = (...prefixes: string[]) => {
  return (digits: string) => prefixes.some((prefix) => digits.startsWith(prefix));
};

const oneOf =
  (...lengths: number[]) =>
  (length: number) =>
    lengths.includes(length);

// Order matters: the first matching rule wins (narrow ranges before broad ones, Maestro last).
const brandRules: BrandRule[] = [
  {
    brand: 'visa',
    generateLength: 16,
    generatePrefix: '4',
    lengths: oneOf(13, 16, 19),
    matches: starts('4'),
  },
  {
    brand: 'mastercard',
    generateLength: 16,
    generatePrefix: '51',
    lengths: oneOf(16),
    matches: anyOf(
      (d) => inRange(d, 2, 51, 55),
      (d) => inRange(d, 4, 2221, 2720),
    ),
  },
  {
    brand: 'amex',
    generateLength: 15,
    generatePrefix: '34',
    lengths: oneOf(15),
    matches: starts('34', '37'),
  },
  {
    brand: 'discover',
    generateLength: 16,
    generatePrefix: '6011',
    lengths: oneOf(16, 19),
    matches: anyOf(starts('6011', '65'), (d) => inRange(d, 3, 644, 649)),
  },
  {
    brand: 'diners',
    generateLength: 14,
    generatePrefix: '36',
    lengths: oneOf(14, 16, 19),
    matches: anyOf(starts('36', '38'), (d) => inRange(d, 3, 300, 305)),
  },
  {
    brand: 'jcb',
    generateLength: 16,
    generatePrefix: '3528',
    lengths: oneOf(16, 19),
    matches: (d) => inRange(d, 4, 3528, 3589),
  },
  {
    brand: 'unionpay',
    generateLength: 16,
    generatePrefix: '62',
    lengths: (length) => length >= 16 && length <= 19,
    matches: starts('62'),
  },
  {
    brand: 'maestro',
    generateLength: 16,
    generatePrefix: '5018',
    lengths: (length) => length >= 12 && length <= 19,
    matches: anyOf(starts('50', '6'), (d) => inRange(d, 2, 56, 59)),
  },
];

function detectRule(digits: string): BrandRule | undefined {
  return brandRules.find((rule) => rule.matches(digits));
}

export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;

  const sum = [...digits].reverse().reduce((total, char, index) => {
    const digit = Number(char);
    const doubled = index % 2 === 1 ? digit * 2 : digit;

    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);

  return sum % 10 === 0;
}

export function luhnDigit(partial: string): string {
  for (let digit = 0; digit < 10; digit += 1) {
    if (luhnCheck(partial + digit)) return String(digit);
  }

  throw new FunctionError('INVALID_INPUT', 'Luhn input must contain digits only.');
}

export function formatCardNumber(digits: string): string {
  if (digits.length === 15 || digits.length === 14)
    return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10)}`;

  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export interface CardCheck {
  brand: CardBrand;
  formatted: string;
  lengthValid: boolean;
  luhnValid: boolean;
  valid: boolean;
}

function checkCardLine(line: string): CardCheck {
  const raw = line.trim();
  const digits = raw.replace(/[ -]/g, '');
  const invalid: CardCheck = {
    brand: 'unknown',
    formatted: raw,
    lengthValid: false,
    luhnValid: false,
    valid: false,
  };

  if (!/^[0-9]{12,19}$/.test(digits)) return invalid;

  const rule = detectRule(digits);

  if (!rule)
    return { ...invalid, formatted: formatCardNumber(digits), luhnValid: luhnCheck(digits) };

  const lengthValid = rule.lengths(digits.length);
  const luhnValid = luhnCheck(digits);

  return {
    brand: rule.brand,
    formatted: formatCardNumber(digits),
    lengthValid,
    luhnValid,
    valid: lengthValid && luhnValid,
  };
}

export function validateCardNumbers(text: string): CardCheck[] {
  return nonBlankLines(text).map((line) => checkCardLine(line));
}

function randomDigits(count: number): string {
  let out = '';

  while (out.length < count) {
    for (const byte of randomBytes(64)) {
      if (byte < 250 && out.length < count) out += String(byte % 10);
    }
  }

  return out;
}

function generateOne(rule: BrandRule): string {
  const partial =
    rule.generatePrefix + randomDigits(rule.generateLength - 1 - rule.generatePrefix.length);

  return partial + luhnDigit(partial);
}

export function generateCardNumbers(brand: Exclude<CardBrand, 'unknown'>, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new FunctionError('INVALID_COUNT', 'Count must be between 1 and 100.');

  const rule = brandRules.find((item) => item.brand === brand);

  if (!rule) throw new FunctionError('INVALID_BRAND', 'Choose a supported card brand.');

  const numbers: string[] = [];

  while (numbers.length < count) numbers.push(generateOne(rule));

  return numbers;
}
