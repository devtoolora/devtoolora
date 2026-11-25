import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { convertCsvDelimiter, type CsvDelimiter } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

const separators = new Map<string, CsvDelimiter>([
  ['comma', ','],
  ['pipe', '|'],
  ['semicolon', ';'],
  ['tab', '\t'],
]);

const separatorNames: Record<CsvDelimiter, string> = {
  '\t': 'tab',
  ',': 'comma',
  ';': 'semicolon',
  '|': 'pipe',
};

const separatorOptions = [
  { label: 'Comma', value: 'comma' },
  { label: 'Semicolon', value: 'semicolon' },
  { label: 'Tab', value: 'tab' },
  { label: 'Pipe', value: 'pipe' },
];

function fromField(value: string | undefined): 'auto' | CsvDelimiter {
  if (!value || value === 'auto') return 'auto';

  const delimiter = separators.get(value);

  if (!delimiter) throw new ToolError('Choose automatic detection, comma, semicolon, tab or pipe.');

  return delimiter;
}

function toField(value: string | undefined): CsvDelimiter {
  const delimiter = separators.get(value || 'tab');

  if (!delimiter)
    throw new ToolError('Choose comma, semicolon, tab or pipe as the output separator.');

  return delimiter;
}

function quoteAllField(value: string | undefined): boolean {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;

  throw new ToolError('Checkbox values must be true or false.');
}

function convert(fields: Record<string, string>, text: string) {
  const to = toField(fields.to);
  const result = convertCsvDelimiter(text, {
    from: fromField(fields.from),
    quoteAll: quoteAllField(fields.quoteAll),
    to,
  });
  const isTsv = to === '\t';

  return {
    artifact: {
      base64: encodeBase64Text(result.text),
      fileName: isTsv ? 'converted.tsv' : 'converted.csv',
      mimeType: isTsv ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8',
    },
    language: isTsv ? 'plaintext' : 'csv',
    summary: `${result.rows.toLocaleString('en-US')} ${result.rows === 1 ? 'row' : 'rows'} converted from ${separatorNames[result.from]} to ${separatorNames[to]}.`,
    text: result.text,
  };
}

export const csvDelimiterConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Change the separator of CSV text locally: comma, semicolon, tab (TSV) or pipe, detected or chosen. Quoted fields, line breaks in cells and ragged rows are kept.',
  fields: [
    {
      defaultValue: 'auto',
      help: 'Automatic detection picks the separator used most consistently in the first 20 records, and falls back to comma.',
      id: 'from',
      label: 'Input separator',
      options: [{ label: 'Detect', value: 'auto' }, ...separatorOptions],
      type: 'select',
    },
    {
      defaultValue: 'tab',
      id: 'to',
      label: 'Output separator',
      options: separatorOptions,
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'Off quotes only fields with the separator, a double quote, a line break, or leading or trailing spaces.',
      id: 'quoteAll',
      label: 'Quote every field',
      type: 'checkbox',
    },
  ],
  id: 'csv-delimiter-converter',
  inputKind: 'text',
  keywords: [
    'csv',
    'tsv',
    'csv to tsv',
    'tsv to csv',
    'delimiter',
    'separator',
    'semicolon',
    'pipe',
    'tab separated',
    'excel',
    'convert',
  ],
  name: 'CSV Delimiter Converter',
  outputKind: 'text',
  relatedToolIds: ['json-to-csv', 'csv-profiler'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => convert(fields, text)),
  samples: [
    {
      fields: { from: 'auto', quoteAll: 'false', to: 'tab' },
      label: 'CSV to TSV',
      text: 'name,role,team\nAda,admin,core\nGrace,dev,"compilers, tools"\n',
    },
    {
      fields: { from: 'auto', quoteAll: 'false', to: 'comma' },
      label: 'TSV to CSV',
      text: 'id\tname\tnote\n001\tAda\t"says ""hi"""\n002\tGrace\t\n',
    },
    {
      fields: { from: 'auto', quoteAll: 'false', to: 'comma' },
      label: 'European semicolon CSV',
      text: 'product;price;qty\nApple;1,20;3\nPear;0,95;12\n',
    },
    {
      fields: { from: 'auto', quoteAll: 'false', to: 'comma' },
      label: 'Pipe-separated export',
      text: 'host|port|status\napi.example.com|443|up\ndb.example.com|5432|down\n',
    },
    {
      fields: { from: 'comma', quoteAll: 'true', to: 'semicolon' },
      label: 'Quote every field',
      text: 'city,note\nPrague,"Line one\nLine two"\nBrno,plain\n',
    },
    {
      fields: { from: 'auto', quoteAll: 'false', to: 'pipe' },
      label: 'Ragged rows',
      text: 'a,b,c\n1,2\n3,4,5,6\n',
    },
  ],
  supportsSelection: true,
};

export const csvToTsvTool: ToolDefinition = {
  ...csvDelimiterConverterTool,
  aliasOf: 'csv-delimiter-converter',
  id: 'csv-to-tsv',
  name: 'CSV to TSV',
};
