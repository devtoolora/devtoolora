import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { detectCsvDelimiter, transformCsvColumns } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

function transposeField(value: string | undefined): boolean {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;

  throw new ToolError('Checkbox values must be true or false.');
}

function count(value: number, noun: string): string {
  return `${value.toLocaleString('en-US')} ${noun}${value === 1 ? '' : 's'}`;
}

function transform(fields: Record<string, string>, text: string) {
  const result = transformCsvColumns(text, {
    columns: fields.columns ?? '',
    rename: fields.rename ?? '',
    transpose: transposeField(fields.transpose),
  });
  const isTsv = detectCsvDelimiter(text) === '\t';

  return {
    artifact: {
      base64: encodeBase64Text(result.text),
      fileName: isTsv ? 'columns.tsv' : 'columns.csv',
      mimeType: isTsv ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8',
    },
    language: isTsv ? 'plaintext' : 'csv',
    summary: `${count(result.rows, 'row')}, ${count(result.columns, 'column')}.`,
    text: result.text,
  };
}

export const csvColumnsTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Pick, reorder, repeat, rename and transpose CSV columns locally by header name or position. The input separator is detected and kept.',
  fields: [
    {
      defaultValue: '',
      help: 'Comma-separated header names or 1-based numbers, in the order you want them. Empty keeps every column.',
      id: 'columns',
      label: 'Columns',
      placeholder: 'name, 1',
      type: 'text',
    },
    {
      defaultValue: '',
      help: 'Comma-separated old=new pairs, applied to the selected columns.',
      id: 'rename',
      label: 'Rename',
      placeholder: 'name=full_name',
      type: 'text',
    },
    {
      defaultValue: 'false',
      help: 'Turns rows into columns after selecting and renaming.',
      id: 'transpose',
      label: 'Transpose',
      type: 'checkbox',
    },
  ],
  id: 'csv-columns',
  inputKind: 'text',
  keywords: [
    'csv',
    'tsv',
    'columns',
    'select columns',
    'reorder columns',
    'rename columns',
    'transpose',
    'drop column',
    'pick columns',
  ],
  name: 'CSV Columns',
  outputKind: 'text',
  relatedToolIds: ['csv-delimiter-converter', 'json-to-csv'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => transform(fields, text)),
  samples: [
    {
      fields: { columns: 'name,1', rename: '', transpose: 'false' },
      label: 'Reorder by name and number',
      text: 'id,name,age\n1,Ada,36\n2,Grace,45\n',
    },
    {
      fields: { columns: 'email', rename: '', transpose: 'false' },
      label: 'Keep one column',
      text: 'id,name,email\n1,Ada,ada@example.com\n2,Grace,grace@example.com\n',
    },
    {
      fields: { columns: '', rename: 'name=full_name,age=years', transpose: 'false' },
      label: 'Rename headers',
      text: 'id,name,age\n1,Ada,36\n2,Grace,45\n',
    },
    {
      fields: { columns: '', rename: '', transpose: 'true' },
      label: 'Transpose',
      text: 'id,name,age\n1,Ada,36\n',
    },
    {
      fields: { columns: '2,2,1', rename: 'b=copy', transpose: 'false' },
      label: 'Repeat a column',
      text: 'a;b;c\n1;2;3\n4;5;6\n',
    },
    {
      fields: { columns: 'c,a', rename: '', transpose: 'false' },
      label: 'Ragged rows',
      text: 'a,b,c\n1\n2,3,4,5\n',
    },
  ],
  supportsSelection: true,
};
