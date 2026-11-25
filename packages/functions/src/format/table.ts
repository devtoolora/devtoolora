import { FunctionError } from '../errors';
import { csvLimits, parseCsv } from './csv';
import { JsonNumberToken, parseLosslessJsonData, type LosslessJsonValue } from './jsonDocument';
import { stringifyLosslessJson } from './json';
import { markdownCell } from './jsonTable';

type TableAlign = 'center' | 'left' | 'right';

export interface TableOptions {
  align: TableAlign;
  format: 'auto' | 'csv' | 'json';
  header: boolean;
  output: 'ascii' | 'html' | 'markdown' | 'unicode';
}

export interface TableResult {
  columns: number;
  rows: number;
  text: string;
}

interface TableData {
  body: string[][];
  header: string[];
}

interface PreparedTable extends TableData {
  align: TableAlign;
  widths: number[];
}

interface TextFrame {
  bottom: [string, string, string];
  fill: string;
  middle: [string, string, string];
  top: [string, string, string];
  vertical: string;
}

const maxColumns = 1_000;
const maxOutputCharacters = 20_000_000;

const textFrames: Record<'ascii' | 'unicode', TextFrame> = {
  ascii: {
    bottom: ['+', '+', '+'],
    fill: '-',
    middle: ['+', '+', '+'],
    top: ['+', '+', '+'],
    vertical: '|',
  },
  unicode: {
    bottom: ['└', '┴', '┘'],
    fill: '─',
    middle: ['├', '┼', '┤'],
    top: ['┌', '┬', '┐'],
    vertical: '│',
  },
};

export function generateTable(input: string, options: TableOptions): TableResult {
  const isJson =
    options.format === 'json' || (options.format === 'auto' && /^[[{]/.test(input.trimStart()));
  const data = isJson ? readJson(input) : readCsv(input, options.header);
  const columns = data.header.length;

  if (columns === 0) throw new FunctionError('INVALID_TABLE', 'The table has no columns.');

  const text = writeTable(data, options);

  return { columns, rows: data.body.length, text };
}

function limit(count: number, noun: string): FunctionError {
  return new FunctionError(
    'TABLE_LIMIT',
    `The table is limited to ${count.toLocaleString('en-US')} ${noun}.`,
  );
}

function checkSize(columns: number, rows: number): void {
  if (columns > maxColumns) throw limit(maxColumns, 'columns');
  if (rows > csvLimits.rows) throw limit(csvLimits.rows, 'rows');
  if ((rows + 1) * columns > csvLimits.cells) throw limit(csvLimits.cells, 'cells');
}

function normalize(header: string[], body: string[][]): TableData {
  // Bound the row count first and measure with a loop: spreading a huge array overflows the stack.
  if (body.length > csvLimits.rows) throw limit(csvLimits.rows, 'rows');

  let columns = header.length;

  for (const row of body) columns = Math.max(columns, row.length);

  checkSize(columns, body.length);

  const pad = (row: string[]) => Array.from({ length: columns }, (_, index) => row[index] ?? '');

  return {
    body: body.map(pad),
    header: Array.from({ length: columns }, (_, index) => header[index] ?? `Column ${index + 1}`),
  };
}

function readCsv(input: string, hasHeader: boolean): TableData {
  const rows = input.trim() ? parseCsv(input) : [];

  return hasHeader ? normalize(rows[0] ?? [], rows.slice(1)) : normalize([], rows);
}

function jsonType(value: LosslessJsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'object';
  if (value instanceof JsonNumberToken) return 'number';

  return typeof value;
}

function cellText(value: LosslessJsonValue | undefined): string {
  if (value === undefined) return '';

  return typeof value === 'string' ? value : stringifyLosslessJson(value);
}

function readJson(input: string): TableData {
  if (input.length > csvLimits.characters)
    throw new FunctionError(
      'TABLE_LIMIT',
      `The input is limited to ${csvLimits.characters.toLocaleString('en-US')} characters.`,
    );

  const root = parseLosslessJsonData(input).value;

  if (!Array.isArray(root))
    throw new FunctionError(
      'INVALID_TABLE',
      'JSON input must be an array of objects or an array of arrays.',
    );

  const [first] = root;

  if (root.length === 0) return { body: [], header: [] };
  if (!(first instanceof Map) && !Array.isArray(first))
    throw rowError(0, 'an object or an array', first ?? null);

  return first instanceof Map ? readRecords(root) : readArrays(root);
}

function rowError(index: number, expected: string, actual: LosslessJsonValue): FunctionError {
  return new FunctionError(
    'INVALID_TABLE',
    `Row ${index + 1} must be ${expected}, not ${jsonType(actual)}.`,
  );
}

function readRecords(root: LosslessJsonValue[]): TableData {
  const names = new Set<string>();

  for (const [index, row] of root.entries()) {
    if (!(row instanceof Map)) throw rowError(index, 'an object', row);

    for (const key of row.keys()) names.add(key);
    if (names.size > maxColumns) throw limit(maxColumns, 'columns');
  }

  const header = [...names];

  checkSize(header.length, root.length);

  return {
    body: root.map((row) =>
      header.map((key) => cellText((row as Map<string, LosslessJsonValue>).get(key))),
    ),
    header,
  };
}

function readArrays(root: LosslessJsonValue[]): TableData {
  const rows = root.map((row, index) => {
    if (!Array.isArray(row)) throw rowError(index, 'an array', row);

    return row.map(cellText);
  });

  return normalize(rows[0] ?? [], rows.slice(1));
}

const codePoints = (text: string): number => [...text].length;

function pad(text: string, width: number, align: TableAlign): string {
  const gap = width - codePoints(text);

  if (align === 'right') return ' '.repeat(gap) + text;
  if (align === 'center')
    return ' '.repeat(Math.floor(gap / 2)) + text + ' '.repeat(Math.ceil(gap / 2));

  return text + ' '.repeat(gap);
}

const htmlEntities: Record<string, string> = {
  '"': '&quot;',
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

const escapeHtml = (text: string): string =>
  text
    .replace(/[&<>"]/g, (character) => htmlEntities[character] ?? character)
    .replace(/\r\n|\r|\n/g, '<br>');

function prepare(data: TableData, options: TableOptions): PreparedTable {
  const escape = {
    ascii: (text: string) => text.replace(/\r\n|\r|\n/g, ' '),
    html: escapeHtml,
    markdown: markdownCell,
    unicode: (text: string) => text.replace(/\r\n|\r|\n/g, ' '),
  }[options.output];
  const header = data.header.map(escape);
  const body = data.body.map((row) => row.map(escape));
  const minimum = options.output === 'markdown' ? 3 : 0;
  const widths = header.map((_, index) =>
    body.reduce(
      (widest, row) => Math.max(widest, codePoints(row[index] ?? '')),
      Math.max(minimum, codePoints(header[index] ?? '')),
    ),
  );

  return { align: options.align, body, header, widths };
}

function writeTable(data: TableData, options: TableOptions): string {
  const lines: string[] = [];
  let size = 0;

  const add = (line: string): void => {
    size += line.length + 1;
    if (size > maxOutputCharacters)
      throw new FunctionError(
        'TABLE_LIMIT',
        `The table output is limited to ${maxOutputCharacters.toLocaleString('en-US')} characters.`,
      );

    lines.push(line);
  };

  const table = prepare(data, options);

  if (options.output === 'html') writeHtml(add, table);
  else if (options.output === 'markdown') writeMarkdown(add, table);
  else writeText(add, table, textFrames[options.output]);

  return `${lines.join('\n')}\n`;
}

function writeMarkdown(add: (line: string) => void, table: PreparedTable): void {
  const { align, body, header, widths } = table;
  const row = (cells: string[]) =>
    `| ${cells.map((cell, index) => pad(cell, widths[index] ?? 0, align)).join(' | ')} |`;

  const rule = (width: number) => {
    if (align === 'right') return `${'-'.repeat(width - 1)}:`;
    if (align === 'center') return `:${'-'.repeat(width - 2)}:`;

    return `:${'-'.repeat(width - 1)}`;
  };

  add(row(header));
  add(`| ${widths.map(rule).join(' | ')} |`);
  body.forEach((cells) => add(row(cells)));
}

function writeHtml(add: (line: string) => void, table: PreparedTable): void {
  const style = table.align === 'left' ? '' : ` style="text-align: ${table.align}"`;

  const row = (tag: string, cells: string[]) => {
    add('    <tr>');
    cells.forEach((cell) => add(`      <${tag}${style}>${cell}</${tag}>`));
    add('    </tr>');
  };

  add('<table>');
  add('  <thead>');
  row('th', table.header);
  add('  </thead>');
  add('  <tbody>');
  table.body.forEach((cells) => row('td', cells));
  add('  </tbody>');
  add('</table>');
}

function writeText(add: (line: string) => void, table: PreparedTable, frame: TextFrame): void {
  const { align, body, header, widths } = table;
  const row = (cells: string[]) =>
    `${frame.vertical} ${cells.map((cell, index) => pad(cell, widths[index] ?? 0, align)).join(` ${frame.vertical} `)} ${frame.vertical}`;
  const rule = ([left, middle, right]: [string, string, string]) =>
    left + widths.map((width) => frame.fill.repeat(width + 2)).join(middle) + right;

  add(rule(frame.top));
  add(row(header));
  add(rule(frame.middle));
  body.forEach((cells) => add(row(cells)));
  add(rule(frame.bottom));
}
