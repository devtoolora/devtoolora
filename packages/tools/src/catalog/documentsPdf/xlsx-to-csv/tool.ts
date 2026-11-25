import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode, utf8Bytes } from '@devtoolora/functions/binary';
import { writeCsvRows } from '@devtoolora/functions/format';
import { readXlsx, type XlsxSheet, type XlsxValue } from '@devtoolora/functions/office';
import { csvSeparatorField, csvWriteOptions } from '../../../adapters/csvOptions';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';
import { fileBytesFromField } from '../../../adapters/files';
import { pdfBaseName } from '@devtoolora/functions/pdf';
import { browserSafeCapabilities } from '../shared';
import { sampleFile } from './sample';

const outputs = ['csv', 'json'] as const;
const shapes = ['records', 'rows'] as const;
const xlsxMaxBytes = 20 * 1024 * 1024;

type XlsxOutput = (typeof outputs)[number];

const xlsxFields = (defaultOutput: XlsxOutput): ToolField[] => [
  {
    accept: '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    id: 'file',
    label: 'Workbook',
    maxBytes: xlsxMaxBytes,
    required: true,
    type: 'file',
  },
  {
    defaultValue: defaultOutput,
    id: 'output',
    label: 'Output',
    options: [
      { label: 'CSV', value: 'csv' },
      { label: 'JSON', value: 'json' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  {
    help: 'Leave blank for the first sheet, or type a sheet name or its number (1 is the first).',
    id: 'sheet',
    label: 'Sheet',
    placeholder: 'First sheet',
    type: 'text',
    visibleWhen: { field: 'allSheets', isNot: ['true'] },
  },
  { defaultValue: 'false', id: 'allSheets', label: 'All sheets', type: 'checkbox' },
  { ...csvSeparatorField, visibleWhen: { field: 'output', is: ['csv'] } },
  {
    defaultValue: 'records',
    id: 'jsonShape',
    label: 'JSON shape',
    options: [
      { label: 'Records', value: 'records' },
      { label: 'Rows', value: 'rows' },
    ],
    presentation: 'segmented',
    type: 'select',
    visibleWhen: { field: 'output', is: ['json'] },
  },
];

const csvText = (value: XlsxValue): string => {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  return String(value);
};

function records(rows: XlsxValue[][]): Array<Record<string, XlsxValue>> {
  const [header = [], ...body] = rows;
  const used = new Set<string>();
  const keys = header.map((cell, index) => {
    const base = csvText(cell) || `Column ${index + 1}`;
    let key = base;

    for (let copy = 2; used.has(key); copy += 1) key = `${base}_${copy}`;

    used.add(key);

    return key;
  });

  return body.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? null])));
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

function describeSheet(sheet: XlsxSheet): string {
  const columns = sheet.rows[0]?.length ?? 0;
  const parts = [`${plural(sheet.rows.length, 'row')} × ${plural(columns, 'column')}`];

  if (sheet.dates) parts.push(plural(sheet.dates, 'date'));
  if (sheet.formulas) parts.push(`${plural(sheet.formulas, 'formula')} (cached values)`);

  return `Sheet "${sheet.name}": ${parts.join(', ')}.`;
}

function artifactOf(text: string, fileName: string, output: XlsxOutput) {
  return {
    base64: base64Encode(utf8Bytes(text)),
    fileName,
    mimeType: output === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
  };
}

type Rendering = { artifacts: ReturnType<typeof artifactOf>[]; text: string };

function renderJson(
  sheets: XlsxSheet[],
  book: string,
  allSheets: boolean,
  named: boolean,
  shape: string,
): Rendering {
  const data = (sheet: XlsxSheet) => (shape === 'records' ? records(sheet.rows) : sheet.rows);
  const first = sheets[0] as XlsxSheet;
  const text = JSON.stringify(
    allSheets ? Object.fromEntries(sheets.map((sheet) => [sheet.name, data(sheet)])) : data(first),
    null,
    2,
  );

  return {
    artifacts: [
      artifactOf(
        text,
        allSheets || !named ? `${book}.json` : `${book}-${first.name || 'sheet'}.json`,
        'json',
      ),
    ],
    text,
  };
}

function renderCsv(
  sheets: XlsxSheet[],
  book: string,
  allSheets: boolean,
  named: boolean,
  fields: Record<string, string>,
): Rendering {
  const { delimiter } = csvWriteOptions(fields);
  const taken = new Set<string>();
  const parts = sheets.map((sheet) => {
    // Sheet names come from the file; keep them out of path syntax in the download name.
    const safe = sheet.name.replace(/[\\/:*?"<>|\p{Cc}]/gu, '_');
    const base = named ? `${book}-${safe || 'sheet'}` : book;
    let name = base;

    for (let copy = 2; taken.has(name); copy += 1) name = `${base}-${copy}`;

    taken.add(name);

    const rows = sheet.rows.map((row) => row.map(csvText));

    return {
      file: `${name}.csv`,
      name: sheet.name,
      text: withToolError(() =>
        writeCsvRows(rows, { delimiter: delimiter ?? ',', lineEnding: '\n', quoteAll: false }),
      ),
    };
  });

  return {
    artifacts: parts.map((part) => artifactOf(part.text, part.file, 'csv')),
    text: allSheets
      ? parts.map((part) => `# ${part.name}\n${part.text}`).join('\n')
      : (parts[0]?.text ?? ''),
  };
}

function convertXlsx(fields: Record<string, string>, defaultOutput: XlsxOutput): ToolResult {
  const output = choiceField(fields.output, defaultOutput, outputs, 'Output must be csv or json.');
  const shape = choiceField(
    fields.jsonShape,
    'records',
    shapes,
    'JSON shape must be records or rows.',
  );
  const allSheets = booleanField(fields.allSheets, false);
  const file = fileBytesFromField(fields.file, 'Workbook');

  const book = pdfBaseName(fields.fileName ?? '');
  const { sheets, skipped } = withToolError(() =>
    readXlsx(file.bytes, { allSheets, sheet: allSheets ? '' : (fields.sheet ?? '') }),
  );
  const named = sheets.length > 1 || Boolean(fields.sheet);
  const { artifacts, text } =
    output === 'json'
      ? renderJson(sheets, book, allSheets, named, shape)
      : renderCsv(sheets, book, allSheets, named, fields);
  const summary = [
    ...sheets.map(describeSheet),
    ...(skipped.length ? [`Skipped chart or dialog sheets: ${skipped.join(', ')}.`] : []),
  ].join(' ');

  return artifacts.length === 1
    ? { artifact: artifacts[0], language: output, summary, text }
    : { artifacts, language: output, summary, text };
}

export const xlsxToCsvTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'Convert an Excel workbook to CSV or JSON, one sheet or all sheets, with dates as ISO text and formula results, locally.',
  fields: xlsxFields('csv'),
  freshResults: true,
  id: 'xlsx-to-csv',
  inputKind: 'none',
  keywords: ['xlsx to csv', 'xlsx to json', 'excel to csv', 'excel to json', 'spreadsheet', 'xlsm'],
  name: 'XLSX to CSV & JSON',
  outputKind: 'text',
  relatedToolIds: ['json-to-csv', 'csv-columns', 'csv-diff'],
  resultActions: ['copy', 'save'],
  run: ({ fields }) => convertXlsx(fields, 'csv'),
  samples: [
    { fields: { ...sampleFile, output: 'csv' }, label: 'First sheet as CSV' },
    { fields: { ...sampleFile, output: 'json' }, label: 'First sheet as JSON records' },
    { fields: { ...sampleFile, jsonShape: 'rows', output: 'json' }, label: 'JSON rows' },
    { fields: { ...sampleFile, output: 'csv', sheet: 'Notes' }, label: 'Pick the Notes sheet' },
    {
      fields: { ...sampleFile, allSheets: 'true', delimiter: 'semicolon', output: 'csv' },
      label: 'All sheets, semicolon separated',
    },
    { fields: { ...sampleFile, allSheets: 'true', output: 'json' }, label: 'All sheets as JSON' },
  ],
  supportsSelection: false,
};

export const xlsxToJsonTool: ToolDefinition = {
  ...xlsxToCsvTool,
  aliasOf: 'xlsx-to-csv',
  description:
    'Convert an Excel workbook to JSON records or rows, one sheet or all sheets, with dates as ISO text and formula results, locally.',
  fields: xlsxFields('json'),
  id: 'xlsx-to-json',
  name: 'XLSX to JSON',
  run: ({ fields }) => convertXlsx(fields, 'json'),
};
