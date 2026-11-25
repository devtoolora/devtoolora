import { mathError, required } from './shared';

const maxLines = 10_000;
const maxLineLength = 64;
const rangeMessage = 'Roman numerals cover 1-3,999.';
const symbols: ReadonlyArray<[string, number]> = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
];
const letterValues: Record<string, number> = { C: 100, D: 500, I: 1, L: 50, M: 1000, V: 5, X: 10 };

export interface RomanLinesResult {
  invalid: number;
  text: string;
  valid: number;
}

export function toRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999) throw mathError(rangeMessage);

  let rest = value;
  let result = '';

  for (const [symbol, amount] of symbols) {
    while (rest >= amount) {
      result += symbol;
      rest -= amount;
    }
  }

  return result;
}

export function fromRoman(text: string): number {
  const input = text.toUpperCase();
  let value = 0;

  for (let index = 0; index < input.length; index += 1) {
    const current = letterValues[input.charAt(index)] ?? 0;
    const next = letterValues[input.charAt(index + 1)] ?? 0;

    value += current < next ? -current : current;
  }

  const standard = toRoman(value);

  if (standard !== input) {
    throw mathError(`not a standard Roman numeral; standard form is ${standard}.`);
  }

  return value;
}

function convertLine(line: string): string {
  if (/^\d+$/.test(line)) return toRoman(Number(line));
  if (/^[ivxlcdm]+$/i.test(line)) return String(fromRoman(line));

  throw mathError('use digits or the letters I, V, X, L, C, D and M.');
}

export function convertRomanLines(text: string): RomanLinesResult {
  const lines = required(text, 'Roman numeral').split('\n');

  if (lines.length > maxLines) {
    throw mathError(`Roman numeral input is limited to ${maxLines.toLocaleString('en-US')} lines.`);
  }

  let valid = 0;
  let invalid = 0;
  const output = lines.map((raw, index) => {
    const line = raw.trim();

    if (line.length > maxLineLength) {
      throw mathError(`Line ${index + 1} is longer than ${maxLineLength} characters.`);
    }
    if (!line) return '';

    try {
      const converted = convertLine(line);

      valid += 1;

      return `${line} → ${converted}`;
    } catch (error) {
      invalid += 1;

      return `${line} → error: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  return { invalid, text: `${output.join('\n')}\n`, valid };
}
