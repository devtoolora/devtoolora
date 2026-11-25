import { FunctionError } from '../errors';
import { stringifyLosslessJson, type JsonValue } from './json';
import { parseLosslessJsonData, type LosslessJsonValue } from './jsonDocument';

export type CsvDelimiter = ',' | ';' | '\t' | '|';

export interface CsvParseOptions {
  delimiter?: CsvDelimiter;
  skipEmptyLines?: boolean;
}

export interface CsvWriteOptions {
  delimiter?: CsvDelimiter;
  escapeFormulas?: boolean;
  lineEnding?: '\n' | '\r\n';
}

export interface CsvTable {
  headers: string[];
  records: string[][];
}

export const csvLimits: Readonly<{
  cells: number;
  characters: number;
  columns: number;
  rows: number;
}> = {
  cells: 1_000_000,
  characters: 5_000_000,
  columns: 10_000,
  rows: 100_000,
};

export function jsonDocumentToCsv(source: string, options: CsvWriteOptions = {}): string {
  const settings = csvWriteSettings(options);
  const value = parseLosslessJsonData(source).value;

  if (
    !Array.isArray(value) ||
    !value.every((row): row is Map<string, LosslessJsonValue> => row instanceof Map)
  )
    throw notRecords();
  if (value.length > csvLimits.rows) throw csvLimit();

  return writeCsv(value, settings, losslessCell);
}

interface CsvWriteSettings {
  delimiter: CsvDelimiter;
  escapeFormulas: boolean;
  lineEnding: '\n' | '\r\n';
}

/**
 * Cell text, and whether it came from a JSON string, the only kind the formula prefix applies to.
 */
type CsvCell = [text: string, isString: boolean];

function csvWriteSettings(options: CsvWriteOptions): CsvWriteSettings {
  const delimiter = csvDelimiter(options.delimiter);

  if (options.escapeFormulas !== undefined && typeof options.escapeFormulas !== 'boolean')
    throw csvError('Formula prefix must be a boolean option.');

  const lineEnding = options.lineEnding ?? '\n';

  if (lineEnding !== '\n' && lineEnding !== '\r\n')
    throw csvError('Choose LF or CRLF line endings.');

  return { delimiter, escapeFormulas: options.escapeFormulas ?? false, lineEnding };
}

function writeCsv<T>(
  rows: Array<Map<string, T>>,
  settings: CsvWriteSettings,
  cell: (value: T) => CsvCell,
): string {
  const { delimiter, escapeFormulas, lineEnding } = settings;

  if (rows.length === 0) return '';

  const names = new Set<string>();

  for (const row of rows) {
    for (const name of row.keys()) {
      names.add(name);
      if (names.size > csvLimits.columns) throw csvLimit();
    }
  }

  const headers = [...names];

  validateHeaders(headers);
  if ((rows.length + 1) * headers.length > csvLimits.cells) throw csvLimit();

  let output = headers
    .map((name: string) => escapeCell([name, true], delimiter, escapeFormulas))
    .join(delimiter);

  for (const row of rows) {
    const line = headers
      .map((name: string) =>
        escapeCell(
          row.has(name) ? cell(row.get(name) as T) : ['', false],
          delimiter,
          escapeFormulas,
        ),
      )
      .join(delimiter);

    output += `${lineEnding}${line}`;
    if (output.length > csvLimits.characters) throw csvLimit();
  }

  return output;
}

export function csvToJson(text: string, options: CsvParseOptions = {}): JsonValue[] {
  const { headers, records } = parseCsvTable(text, options);

  return records.map((row: string[]) =>
    Object.fromEntries(headers.map((header: string, index: number) => [header, row[index] ?? ''])),
  );
}

export function parseCsvTable(text: string, options: CsvParseOptions = {}): CsvTable {
  const [headers, ...records] = parseCsv(text, options);

  if (!headers) throw csvError('CSV input is empty; include a header row with named columns.');

  validateHeaders(headers);

  for (const [index, row] of records.entries()) {
    if (row.length !== headers.length)
      throw csvError(
        `CSV record ${index + 2} has ${row.length} cells; expected ${headers.length}. No cells were discarded or filled in.`,
      );
  }

  return { headers, records };
}

export function parseCsv(text: string, options: CsvParseOptions = {}): string[][] {
  const delimiter = csvDelimiter(options.delimiter);

  if (options.skipEmptyLines !== undefined && typeof options.skipEmptyLines !== 'boolean')
    throw csvError('Skip blank lines must be a boolean option.');
  if (text.length > csvLimits.characters) throw csvLimit();

  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let state: 'bare' | 'quoted' | 'closed' = 'bare';
  let recordStart = 0;
  let cells = 0;

  const appendCell = (): void => {
    cells += 1;
    if (cells > csvLimits.cells || row.length >= csvLimits.columns) throw csvLimit();

    row.push(value);
    value = '';
    state = 'bare';
  };

  const appendRecord = (end: number): void => {
    if (end > recordStart || options.skipEmptyLines === false) {
      appendCell();
      rows.push(row);
      if (rows.length > csvLimits.rows + 1) throw csvLimit();
    }

    row = [];
    state = 'bare';
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (state === 'quoted') {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') state = 'closed';
      else value += character;
    } else if (character === delimiter) {
      appendCell();
    } else if (character === '\n' || character === '\r') {
      appendRecord(index);
      if (character === '\r' && source[index + 1] === '\n') index += 1;

      recordStart = index + 1;
    } else if (character === '"' && state === 'bare' && value === '') {
      state = 'quoted';
    } else if (state === 'closed' || character === '"') {
      throw csvSyntaxError(
        source,
        index,
        state === 'closed'
          ? 'Expected a separator or line ending after the closing quote.'
          : 'A quoted field must start with a double quote; double quotes inside it must be doubled.',
      );
    } else value += character;
  }

  if (state === 'quoted') throw csvSyntaxError(source, source.length, 'Unterminated quoted field.');
  if (recordStart < source.length) appendRecord(source.length);

  return rows;
}

export function csvDelimiter(delimiter: CsvDelimiter | undefined): CsvDelimiter {
  const value = delimiter ?? ',';

  if (value !== ',' && value !== ';' && value !== '\t' && value !== '|')
    throw csvError('Choose comma, semicolon, tab or pipe as the separator.');

  return value;
}

function validateHeaders(headers: string[]): void {
  if (headers.length === 0 || headers.some((name: string) => name.trim() === ''))
    throw csvError('CSV header row must contain named columns.');

  const names = new Set<string>();

  for (const name of headers) {
    if (names.has(name))
      throw csvError(
        `Duplicate CSV column name ${JSON.stringify(name)}; rename it so no value is overwritten.`,
      );

    names.add(name);
  }
}

function losslessCell(value: LosslessJsonValue): CsvCell {
  if (value === null) return ['', false];

  return typeof value === 'string' ? [value, true] : [stringifyLosslessJson(value), false];
}

function escapeCell(
  [cellText, isString]: CsvCell,
  delimiter: CsvDelimiter,
  escapeFormulas: boolean,
): string {
  let text = cellText;

  if (text.length > csvLimits.characters) throw csvLimit();

  const hasFormulaPrefix =
    escapeFormulas && isString && /^(?:[\t\r\n]|\s*[=+\-@＝＋－＠])/.test(text);

  if (hasFormulaPrefix) text = `'${text}`;

  return hasFormulaPrefix || csvTextNeedsQuotes(text, delimiter) || text === ''
    ? quoteCsvText(text)
    : text;
}

export function csvTextNeedsQuotes(text: string, delimiter: CsvDelimiter): boolean {
  return text.includes(delimiter) || /["\r\n]/.test(text);
}

export function quoteCsvText(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

function csvSyntaxError(source: string, index: number, message: string): FunctionError {
  const lines = source.slice(0, index).split(/\r\n|\r|\n/);

  return csvError(
    `CSV line ${lines.length}, column ${(lines.at(-1) ?? '').length + 1}: ${message}`,
  );
}

function notRecords(): FunctionError {
  return new FunctionError('INVALID_JSON_CSV', 'JSON to CSV expects an array of objects.');
}

function csvError(message: string): FunctionError {
  return new FunctionError('INVALID_CSV', message);
}

export function csvLimit(): FunctionError {
  return new FunctionError(
    'CSV_LIMIT',
    'CSV supports up to 5,000,000 characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header.',
  );
}
