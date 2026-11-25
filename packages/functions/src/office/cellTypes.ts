import { FunctionError } from '../errors';
import { csvLimits } from '../format/csv';
import { isoToExcelSerial } from './excelDates';

export type XlsxCellIn =
  boolean | number | string | null | { format: 'date' | 'datetime'; serial: number };

const numberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
const maxSignificantDigits = 15;
const maxExcelNumber = 9.99999999999999e307;
const minExcelNumber = 2.2250738585072014e-308;

function outsideExcelRange(value: number): boolean {
  return Math.abs(value) > maxExcelNumber || (value !== 0 && Math.abs(value) < minExcelNumber);
}

export function detectCell(text: string): XlsxCellIn {
  if (numberPattern.test(text)) {
    const digits = (text.split(/[eE]/)[0] ?? '').replace(/[-.]/g, '').replace(/^0+/, '');
    const value = Number(text);

    const lost = value === 0 && /[1-9]/.test(digits);

    return digits.length <= maxSignificantDigits &&
      !lost &&
      !outsideExcelRange(value) &&
      !Object.is(value, -0)
      ? value
      : text;
  }

  const lower = text.toLowerCase();

  if (lower === 'true' || lower === 'false') return lower === 'true';

  if (datePattern.test(text)) {
    const serial = isoToExcelSerial(text);

    if (serial !== undefined) return { format: text.includes('T') ? 'datetime' : 'date', serial };
  }

  return text;
}

function jsonError(message: string): FunctionError {
  return new FunctionError('INVALID_JSON', message);
}

function jsonCell(value: unknown, detectTypes: boolean): XlsxCellIn {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw jsonError('A JSON number is too large for a spreadsheet.');

    return outsideExcelRange(value) ? String(value) : value + 0;
  }

  if (typeof value === 'string') return detectTypes ? detectCell(value) : value;

  return JSON.stringify(value);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function rowsFromJson(source: string, detectTypes: boolean): XlsxCellIn[][] {
  if (source.length > csvLimits.characters)
    throw jsonError(
      `The input is limited to ${csvLimits.characters.toLocaleString('en-US')} characters.`,
    );

  let data: unknown;

  try {
    data = JSON.parse(source);
  } catch {
    throw jsonError('The input is not valid JSON.');
  }

  if (!Array.isArray(data) || data.length === 0)
    throw jsonError('Use a non-empty array of objects or an array of arrays.');

  if (data.every(Array.isArray))
    return data.map((row: unknown[]) => row.map((cell) => jsonCell(cell, detectTypes)));

  if (!data.every(isRecord))
    throw jsonError('Use an array of objects or an array of arrays, not a mix.');

  const keys = new Set<string>();

  for (const record of data) for (const key of Object.keys(record)) keys.add(key);

  const header = [...keys];

  return [
    header,
    ...data.map((record) => {
      const entries = new Map(Object.entries(record));

      return header.map((key) => jsonCell(entries.get(key), detectTypes));
    }),
  ];
}
