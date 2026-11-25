import {
  csvDelimiter,
  csvLimit,
  csvLimits,
  csvTextNeedsQuotes,
  parseCsv,
  quoteCsvText,
  type CsvDelimiter,
} from './csv';
import { FunctionError } from '../errors';
import { requiredText } from './shared';

export interface CsvRowsWriteOptions {
  delimiter: CsvDelimiter;
  lineEnding: '\n' | '\r\n';
  quoteAll: boolean;
}

export interface CsvDelimiterConversionOptions {
  from: 'auto' | CsvDelimiter;
  quoteAll: boolean;
  to: CsvDelimiter;
}

export interface CsvDelimiterConversion {
  from: CsvDelimiter;
  rows: number;
  text: string;
}

const detectedDelimiters: CsvDelimiter[] = [',', ';', '\t', '|'];
const detectionRecords = 20;

export function detectCsvDelimiter(text: string): CsvDelimiter {
  const records = delimiterCounts(text);
  let best: CsvDelimiter = ',';
  let bestScore = 0;
  let isTied = false;

  for (const [index, delimiter] of detectedDelimiters.entries()) {
    const score = consistentRecords(records.map((counts: number[]) => counts[index] ?? 0));

    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
      isTied = false;
    } else if (score > 0 && score === bestScore) isTied = true;
  }

  return isTied ? ',' : best;
}

function delimiterCounts(text: string): number[][] {
  const records: number[][] = [];
  let counts = detectedDelimiters.map(() => 0);
  let hasContent = false;
  let isQuoted = false;
  let index = text.startsWith('\uFEFF') ? 1 : 0;

  for (; index < text.length && records.length < detectionRecords; index += 1) {
    const character = text[index];
    const isLineEnd = !isQuoted && (character === '\n' || character === '\r');

    if (isLineEnd && hasContent) records.push(counts);

    hasContent = !isLineEnd;

    if (character === '"') isQuoted = !isQuoted;
    else if (isLineEnd) {
      counts = detectedDelimiters.map(() => 0);
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else if (!isQuoted) {
      const position = detectedDelimiters.findIndex((delimiter) => delimiter === character);

      if (position >= 0) counts[position] = (counts[position] ?? 0) + 1;
    }
  }

  if (hasContent && records.length < detectionRecords) records.push(counts);

  return records;
}

function consistentRecords(counts: number[]): number {
  const frequency = new Map<number, number>();

  for (const count of counts) if (count > 0) frequency.set(count, (frequency.get(count) ?? 0) + 1);

  return Math.max(0, ...frequency.values());
}

export function writeCsvRows(rows: string[][], options: CsvRowsWriteOptions): string {
  const { lineEnding, quoteAll } = options;
  const delimiter = csvDelimiter(options.delimiter);
  let cells = 0;
  let output = '';

  if (rows.length > csvLimits.rows + 1) throw csvLimit();

  for (const row of rows) {
    cells += row.length;
    if (cells > csvLimits.cells || row.length > csvLimits.columns) throw csvLimit();

    // A lone empty cell would be a blank line, which the reader skips.
    const isBlank = row.length === 1 && row[0] === '';

    output += `${row.map((text: string) => writeCell(text, delimiter, quoteAll || isBlank)).join(delimiter)}${lineEnding}`;
    if (output.length > csvLimits.characters) throw csvLimit();
  }

  return output;
}

function writeCell(text: string, delimiter: CsvDelimiter, isForced: boolean): string {
  return isForced || csvTextNeedsQuotes(text, delimiter) || /^ | $/.test(text)
    ? quoteCsvText(text)
    : text;
}

export function convertCsvDelimiter(
  input: string,
  options: CsvDelimiterConversionOptions,
): CsvDelimiterConversion {
  requiredText(input, 'CSV');

  const from = options.from === 'auto' ? detectCsvDelimiter(input) : options.from;
  const rows = parseCsv(input, { delimiter: from });

  return {
    from,
    rows: rows.length,
    text: writeCsvRows(rows, {
      delimiter: options.to,
      lineEnding: '\n',
      quoteAll: options.quoteAll,
    }),
  };
}

export interface CsvColumnsOptions {
  columns: string;
  rename: string;
  transpose: boolean;
}

export interface CsvColumnsResult {
  columns: number;
  rows: number;
  text: string;
}

export function transformCsvColumns(input: string, options: CsvColumnsOptions): CsvColumnsResult {
  requiredText(input, 'CSV');

  const delimiter = detectCsvDelimiter(input);
  const [header = [], ...records] = parseCsv(input, { delimiter });
  const picked = columnIndexes(header, options.columns);

  if (picked.length > csvLimits.columns || picked.length * (records.length + 1) > csvLimits.cells)
    throw csvLimit();

  const names = renamed(
    picked.map((index: number) => header[index] ?? ''),
    options.rename,
  );
  const rows = [names, ...records.map((row: string[]) => picked.map((index) => row[index] ?? ''))];

  if (options.transpose && rows.length > csvLimits.columns)
    throw columnsError(
      `Transposing supports up to ${csvLimits.columns.toLocaleString('en-US')} rows.`,
    );

  const output = options.transpose ? names.map((_, at) => rows.map((row) => row[at] ?? '')) : rows;

  return {
    columns: output[0]?.length ?? 0,
    rows: output.length,
    text: writeCsvRows(output, { delimiter, lineEnding: '\n', quoteAll: false }),
  };
}

/** 0-based header positions for a comma list of 1-based numbers and exact header names. */
function columnIndexes(header: string[], spec: string): number[] {
  const tokens = spec
    .split(',')
    .map((token: string) => token.trim())
    .filter(Boolean);
  const positions = new Map<string, number>();

  for (const [index, name] of header.entries())
    if (!positions.has(name)) positions.set(name, index);

  if (!tokens.length) return header.map((_, index: number) => index);

  return tokens.map((token: string) => {
    const index = /^\d+$/.test(token) ? Number(token) - 1 : positions.get(token);

    if (index === undefined) throw columnsError(`Unknown column "${token}".`);
    if (index < 0 || index >= header.length)
      throw columnsError(
        `There is no column ${token}; the CSV has ${header.length} ${header.length === 1 ? 'column' : 'columns'}.`,
      );

    return index;
  });
}

function renamed(names: string[], spec: string): string[] {
  const renames = new Map<string, string>();

  for (const pair of spec.split(',').map((part: string) => part.trim())) {
    if (!pair) continue;

    const at = pair.indexOf('=');
    const from = pair.slice(0, at).trim();

    if (at < 1 || !from) throw columnsError(`Rename "${pair}" must look like old=new.`);
    if (!names.includes(from)) throw columnsError(`Unknown column "${from}".`);

    renames.set(from, pair.slice(at + 1).trim());
  }

  return names.map((name: string) => renames.get(name) ?? name);
}

function columnsError(message: string): FunctionError {
  return new FunctionError('INVALID_CSV_COLUMNS', message);
}

export interface CsvDiffOptions {
  key: string;
}

export interface CsvDiffCell {
  after: string;
  before: string;
  column: string;
}

export interface CsvDiffRow {
  cells?: CsvDiffCell[];
  key: string;
  kind: 'added' | 'changed' | 'removed';
}

export interface CsvDiff {
  added: number;
  addedColumns: string[];
  changed: number;
  removed: number;
  removedColumns: string[];
  rows: CsvDiffRow[];
}

interface CsvDiffSide {
  columns: Map<string, number>;
  rows: Map<string, string[]>;
}

const csvDiffLimits = { characters: 10_000_000, rows: 10_000 };

export function diffCsv(before: string, after: string, options: CsvDiffOptions): CsvDiff {
  const first = csvDiffSide(before, 'first', options.key);
  const second = csvDiffSide(after, 'second', options.key);
  const shared = [...first.columns].flatMap(([column, at]) => {
    const to = second.columns.get(column);

    return to === undefined ? [] : [{ at, column, to }];
  });
  const diff: CsvDiff = {
    added: 0,
    addedColumns: [...second.columns.keys()].filter((column) => !first.columns.has(column)),
    changed: 0,
    removed: 0,
    removedColumns: [...first.columns.keys()].filter((column) => !second.columns.has(column)),
    rows: [],
  };
  const report = csvDiffReporter(diff);

  for (const [key, row] of first.rows) {
    const other = second.rows.get(key);

    if (!other) report({ key, kind: 'removed' });
    else if (shared.some(({ at, to }) => (row[at] ?? '') !== (other[to] ?? '')))
      report({ key, kind: 'changed' }, () =>
        shared
          .map(({ at, column, to }) => ({ after: other[to] ?? '', before: row[at] ?? '', column }))
          .filter((cell: CsvDiffCell) => cell.after !== cell.before),
      );
  }

  for (const key of second.rows.keys()) if (!first.rows.has(key)) report({ key, kind: 'added' });

  return diff;
}

function csvDiffReporter(diff: CsvDiff) {
  let characters = 0;
  let isFull = false;

  return (row: CsvDiffRow, cells?: () => CsvDiffCell[]): void => {
    diff[row.kind] += 1;
    if (isFull) return;

    const reported = cells ? { ...row, cells: cells() } : row;

    characters += row.key.length;
    for (const cell of reported.cells ?? [])
      characters += cell.after.length + cell.before.length + cell.column.length;

    isFull = diff.rows.length >= csvDiffLimits.rows || characters > csvDiffLimits.characters;
    if (!isFull) diff.rows.push(reported);
  };
}

function csvDiffSide(text: string, side: 'first' | 'second', key: string): CsvDiffSide {
  const label = side === 'first' ? 'First CSV' : 'Second CSV';

  requiredText(text, label);

  const [header = [], ...records] = parseCsvSide(text, label);
  const columns = new Map<string, number>();
  const rows = new Map<string, string[]>();

  for (const [index, name] of header.entries()) {
    if (columns.has(name))
      throw new FunctionError(
        'INVALID_CSV_DIFF',
        `Duplicate column name "${name}" in the ${side} CSV; rename it so no change is missed.`,
      );

    columns.set(name, index);
  }

  const keyIndex = key ? columns.get(key) : undefined;

  if (key && keyIndex === undefined)
    throw new FunctionError(
      'INVALID_CSV_DIFF',
      `Key column "${key}" not found in the ${side} CSV.`,
    );

  for (const [index, row] of records.entries()) {
    const value = keyIndex === undefined ? String(index + 1) : (row[keyIndex] ?? '');

    if (rows.has(value))
      throw new FunctionError(
        'INVALID_CSV_DIFF',
        `Duplicate key "${value}" in the ${side} CSV; key values must be unique.`,
      );

    rows.set(value, row);
  }

  return { columns, rows };
}

function parseCsvSide(text: string, label: string): string[][] {
  try {
    return parseCsv(text, { delimiter: detectCsvDelimiter(text) });
  } catch (error) {
    if (error instanceof FunctionError)
      throw new FunctionError(error.code, `${label}: ${error.message}`);

    throw error;
  }
}

export {
  csvToSqlInsert,
  type CsvSqlDialect,
  type CsvSqlInsert,
  type CsvSqlInsertOptions,
} from './csvSqlInsert';
