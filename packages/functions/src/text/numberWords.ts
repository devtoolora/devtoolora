import { FunctionError } from '../errors/FunctionError';

export type NumberWordsStyle = 'cardinal' | 'currency' | 'ordinal';

const maxLines = 1000;
const maxIntegerDigits = 36;
const maxDecimalDigits = 20;
// A separator only marks thousands: 1234,50 or 3,14 must not silently become another number.
const thousandsGroups = /^[1-9]\d{0,2}([,_\s])\d{3}(?:\1\d{3})*$/;
const ones = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const scales = [
  '',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion',
];
const irregularOrdinals: Record<string, string> = {
  eight: 'eighth',
  five: 'fifth',
  nine: 'ninth',
  one: 'first',
  three: 'third',
  twelve: 'twelfth',
  two: 'second',
};

function fail(message: string): never {
  throw new FunctionError('INVALID_INPUT', message);
}

function below100(n: number): string {
  if (n < 20) return ones[n] ?? '';

  const unit = n % 10;

  return `${tens[Math.floor(n / 10)] ?? ''}${unit ? `-${ones[unit] ?? ''}` : ''}`;
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];

  if (hundreds) parts.push(`${ones[hundreds] ?? ''} hundred`);

  if (rest) parts.push(below100(rest));

  return parts.join(' ');
}

function integerWords(digits: string): string {
  const stripped = digits.replace(/^0+(?=\d)/, '');

  if (stripped === '0') return 'zero';

  const parts: string[] = [];

  for (let end = stripped.length, index = 0; end > 0; end -= 3, index += 1) {
    const group = Number(stripped.slice(Math.max(0, end - 3), end));

    if (group) parts.unshift(`${below1000(group)}${scales[index] ? ` ${scales[index]}` : ''}`);
  }

  return parts.join(' ');
}

function toOrdinal(words: string): string {
  const match = /^(.*?)([a-z]+)$/.exec(words);
  const last = match?.[2] ?? words;
  const head = match?.[1] ?? '';
  const irregular = irregularOrdinals[last];

  if (irregular) return head + irregular;

  if (last.endsWith('y')) return `${head}${last.slice(0, -1)}ieth`;

  return `${head}${last}th`;
}

function parse(value: string): { decimals: string; digits: string; negative: boolean } {
  const match = /^([+-]?)\s*([^.]*)(?:\.(.*))?$/.exec(value.trim());
  const whole = match?.[2] ?? '';
  const digits = thousandsGroups.test(whole) ? whole.replace(/[,_\s]/g, '') : whole;
  const decimals = match?.[3] ?? '';

  if (!/^\d+$/.test(digits)) {
    fail(
      /^\d[\d,_\s]*$/.test(whole)
        ? 'Separators must split the whole part into groups of three digits, as in 1,234,567. Write decimals with a period, as in 3.14.'
        : 'Input is not a number.',
    );
  }

  if (match?.[3] !== undefined && !/^\d+$/.test(decimals)) fail('Input is not a number.');

  if (digits.replace(/^0+/, '').length > maxIntegerDigits) {
    fail(`The integer part is limited to ${maxIntegerDigits} digits.`);
  }

  if (decimals.length > maxDecimalDigits) {
    fail(`The decimal part is limited to ${maxDecimalDigits} decimal digits.`);
  }

  return { decimals, digits, negative: match?.[1] === '-' && /[1-9]/.test(digits + decimals) };
}

export function numberToWords(value: string, style: NumberWordsStyle): string {
  const { decimals, digits, negative } = parse(value);
  const sign = negative ? 'minus ' : '';

  if (style === 'ordinal') {
    if (decimals) fail('Ordinal style needs a whole number.');

    return sign + toOrdinal(integerWords(digits));
  }

  if (style === 'currency') {
    if (decimals.length > 2) fail('Cheque style allows at most 2 decimal places.');

    return `${sign}${integerWords(digits)} and ${decimals.padEnd(2, '0')}/100`;
  }

  const spoken = [...decimals].map((digit) => ones[Number(digit)]).join(' ');

  return `${sign}${integerWords(digits)}${decimals ? ` point ${spoken}` : ''}`;
}

export function separatorReadings(text: string): string | undefined {
  const readings = text
    .split(/\r\n|\r|\n/)
    .filter((line) => /\d[,_\s]\d/.test(line))
    .map((line) => {
      const { decimals, digits, negative } = parse(line);

      return `${negative ? '-' : ''}${digits}${decimals ? `.${decimals}` : ''}`;
    });

  if (readings.length === 0) return undefined;

  const more = readings.length > 3 ? ` and ${readings.length - 3} more` : '';

  return `Read as ${readings.slice(0, 3).join(', ')}${more}`;
}

export function numbersToWords(text: string, style: NumberWordsStyle): string {
  const lines = text.split(/\r\n|\r|\n/);

  if (lines.length > maxLines)
    fail(`Input is limited to ${maxLines.toLocaleString('en-US')} lines.`);

  return lines
    .map((line, index) => {
      if (!line.trim()) return '';

      try {
        return numberToWords(line, style);
      } catch (error) {
        throw new FunctionError(
          'INVALID_INPUT',
          `Line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })
    .join('\n');
}
