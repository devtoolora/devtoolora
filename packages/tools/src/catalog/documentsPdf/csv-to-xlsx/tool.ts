import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { parseCsv } from '@devtoolora/functions/format';
import { detectCell, rowsFromJson, writeXlsx, type XlsxCellIn } from '@devtoolora/functions/office';
import { csvParseOptions, csvReadFields } from '../../../adapters/csvOptions';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const formats = ['csv', 'json'] as const;

type InputFormat = (typeof formats)[number];

const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const toXlsxFields = (defaultFormat: InputFormat): ToolField[] => [
  {
    defaultValue: defaultFormat,
    id: 'inputFormat',
    label: 'Input',
    options: [
      { label: 'CSV', value: 'csv' },
      { label: 'JSON', value: 'json' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  ...csvReadFields.map((field): ToolField => ({
    ...field,
    visibleWhen: { field: 'inputFormat', is: ['csv'] },
  })),
  {
    defaultValue: 'Sheet1',
    help: 'Up to 31 characters, without [ ] : * ? / \\ and without a leading or trailing apostrophe.',
    id: 'sheetName',
    label: 'Sheet name',
    type: 'text',
  },
  {
    defaultValue: 'true',
    help: 'Turns numbers, TRUE/FALSE and ISO dates into typed cells. Leading zeros, long ids and values like 5% stay text.',
    id: 'detectTypes',
    label: 'Detect types',
    type: 'checkbox',
  },
  {
    defaultValue: 'true',
    help: 'Makes the first row bold and freezes it.',
    id: 'headerRow',
    label: 'Header row',
    type: 'checkbox',
  },
];

const slug = (name: string): string =>
  name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'sheet';

function convert(text: string, fields: Record<string, string>, fallback: InputFormat): ToolResult {
  const format = choiceField(fields.inputFormat, fallback, formats, 'Input must be csv or json.');
  const detectTypes = booleanField(fields.detectTypes, true);
  const sheetName = fields.sheetName || 'Sheet1';
  const rows: XlsxCellIn[][] = withToolError(() =>
    format === 'json'
      ? rowsFromJson(text, detectTypes)
      : parseCsv(text, csvParseOptions(fields)).map((row) =>
          row.map((cell) => (detectTypes ? detectCell(cell) : cell)),
        ),
  );
  const { bytes, columns, types } = withToolError(() =>
    writeXlsx(rows, { headerRow: booleanField(fields.headerRow, true), sheetName }),
  );
  const report = JSON.stringify({ columns, rows: rows.length, sheet: sheetName, types }, null, 2);

  return {
    artifact: {
      base64: base64Encode(bytes),
      fileName: `${slug(sheetName)}.xlsx`,
      mimeType: xlsxMime,
    },
    language: 'json',
    summary: `Wrote ${rows.length} rows × ${columns} columns to "${sheetName}": ${types.number} numbers, ${types.date} dates, ${types.boolean} booleans, ${types.text} text cells.`,
    text: report,
  };
}

export const csvToXlsxTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'Convert CSV or JSON to an Excel .xlsx workbook with typed numbers, booleans and dates, a bold frozen header row and a named sheet, locally.',
  fields: toXlsxFields('csv'),
  freshResults: true,
  id: 'csv-to-xlsx',
  inputKind: 'text',
  keywords: ['csv to xlsx', 'json to xlsx', 'csv to excel', 'json to excel', 'spreadsheet', 'xlsx'],
  name: 'CSV & JSON to XLSX',
  outputKind: 'text',
  relatedToolIds: ['xlsx-to-csv', 'json-to-csv', 'csv-columns'],
  resultActions: ['save', 'copy'],
  run: ({ fields, text }) => convert(text, fields, 'csv'),
  samples: [
    {
      fields: { inputFormat: 'csv' },
      label: 'CSV with a header row',
      text: 'Name,Team,Joined,Hours,Billable\nAda Lovelace,Platform,2024-03-11,38.5,true\nGrace Hopper,Compilers,2023-11-02,41,false\nAlan Turing,Research,2025-01-20T09:30,12.25,true',
    },
    {
      fields: { detectTypes: 'false', inputFormat: 'csv' },
      label: 'Keep every cell as text',
      text: 'id,zip,note\n001,01234,5%\n002,98765,1,000',
    },
    {
      fields: { delimiter: 'semicolon', inputFormat: 'csv', sheetName: 'Orders' },
      label: 'Semicolon CSV on a named sheet',
      text: 'order;total;paid\nA-1;19.90;true\nA-2;5;false',
    },
    {
      fields: { headerRow: 'false', inputFormat: 'csv' },
      label: 'No header row',
      text: '1,2,3\n4,5,6',
    },
    {
      fields: { inputFormat: 'json' },
      label: 'JSON records',
      text: '[{"id":1,"name":"Ada","active":true,"since":"2024-03-11"},{"id":2,"name":"Grace","tags":["a","b"]}]',
    },
    {
      fields: { inputFormat: 'json', sheetName: 'Matrix' },
      label: 'JSON array of arrays',
      text: '[["x","y"],[1,2.5],[3,null]]',
    },
  ],
  supportsSelection: false,
};

export const jsonToXlsxTool: ToolDefinition = {
  ...csvToXlsxTool,
  aliasOf: 'csv-to-xlsx',
  fields: toXlsxFields('json'),
  id: 'json-to-xlsx',
  name: 'JSON to XLSX',
  run: ({ fields, text }) => convert(text, fields, 'json'),
};
