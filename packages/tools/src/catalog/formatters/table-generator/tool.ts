import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  generateTable,
  jsonDuplicateWarning,
  type TableOptions,
} from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

const outputs = new Map<
  TableOptions['output'],
  { fileName: string; label: string; language: string; mimeType: string }
>([
  [
    'markdown',
    {
      fileName: 'table.md',
      label: 'Markdown',
      language: 'markdown',
      mimeType: 'text/markdown;charset=utf-8',
    },
  ],
  [
    'html',
    {
      fileName: 'table.html',
      label: 'HTML',
      language: 'html',
      mimeType: 'text/html;charset=utf-8',
    },
  ],
  [
    'ascii',
    {
      fileName: 'table.txt',
      label: 'ASCII',
      language: 'plaintext',
      mimeType: 'text/plain;charset=utf-8',
    },
  ],
  [
    'unicode',
    {
      fileName: 'table.txt',
      label: 'Unicode',
      language: 'plaintext',
      mimeType: 'text/plain;charset=utf-8',
    },
  ],
]);

function choose<T extends string>(value: string, allowed: readonly T[], message: string): T {
  const match = allowed.find((candidate) => candidate === value);

  if (match === undefined) throw new ToolError(message);

  return match;
}

function checkbox(value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new ToolError('Checkbox values must be true or false.');
}

export const tableGeneratorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Turn CSV or JSON into a Markdown, HTML, ASCII or Unicode table locally, with padded columns and one alignment.',
  fields: [
    {
      defaultValue: 'auto',
      id: 'format',
      label: 'Input',
      options: [
        { label: 'Auto', value: 'auto' },
        { label: 'CSV', value: 'csv' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'markdown',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Markdown', value: 'markdown' },
        { label: 'HTML', value: 'html' },
        { label: 'ASCII', value: 'ascii' },
        { label: 'Unicode', value: 'unicode' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'left',
      id: 'align',
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Off names the columns Column 1, Column 2 and so on, and keeps the first row as data.',
      id: 'header',
      label: 'First CSV row is the header',
      type: 'checkbox',
      visibleWhen: { field: 'format', is: ['auto', 'csv'] },
    },
  ],
  id: 'table-generator',
  inputKind: 'text',
  keywords: [
    'table',
    'markdown table',
    'html table',
    'ascii table',
    'csv to markdown',
    'json to table',
    'box drawing',
    'github table',
  ],
  name: 'Table Generator',
  outputKind: 'text',
  relatedToolIds: ['json-table', 'csv-columns', 'json-to-csv'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = choose(
        fields.output ?? 'markdown',
        ['markdown', 'html', 'ascii', 'unicode'] as const,
        'Choose Markdown, HTML, ASCII or Unicode as the output.',
      );
      const result = generateTable(text, {
        align: choose(
          fields.align ?? 'left',
          ['left', 'center', 'right'] as const,
          'Choose left, center or right alignment.',
        ),
        format: choose(
          fields.format ?? 'auto',
          ['auto', 'csv', 'json'] as const,
          'Choose Auto, CSV or JSON as the input.',
        ),
        header: checkbox(fields.header ?? 'true'),
        output,
      });
      const kind = outputs.get(output);

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: kind?.fileName ?? 'table.txt',
          mimeType: kind?.mimeType ?? 'text/plain;charset=utf-8',
        },
        language: kind?.language ?? 'plaintext',
        summary: withWarning(
          `${plural(result.rows, 'row')} × ${plural(result.columns, 'column')} as ${kind?.label ?? output}.`,
          fields.format === 'csv' ? undefined : jsonDuplicateWarning(text),
        ),
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { align: 'left', format: 'auto', header: 'true', output: 'markdown' },
      label: 'CSV to a Markdown table',
      text: 'name,role,age\nAda,Engineer,36\nGrace,Admiral,85\n',
    },
    {
      fields: { align: 'right', format: 'auto', header: 'true', output: 'markdown' },
      label: 'Right-aligned numbers',
      text: 'item,qty,price\nTea,2,3.50\nCoffee,10,12.00\n',
    },
    {
      fields: { align: 'left', format: 'json', header: 'true', output: 'markdown' },
      label: 'JSON records with missing keys',
      text: '[{"id":1,"name":"Ada"},{"id":2,"email":"grace@example.com"}]',
    },
    {
      fields: { align: 'center', format: 'auto', header: 'true', output: 'html' },
      label: 'HTML table, centered',
      text: 'tag,meaning\n<b>,bold\n<i>,italic\n',
    },
    {
      fields: { align: 'left', format: 'auto', header: 'false', output: 'unicode' },
      label: 'Unicode box without a header row',
      text: 'a,b,c\n1,2,3\n',
    },
    {
      fields: { align: 'left', format: 'json', header: 'true', output: 'ascii' },
      label: 'Array of arrays as ASCII',
      text: '[["key","value"],["name","Ada"],["tags",["a","b"]]]',
    },
  ],
  supportsSelection: true,
};

export const markdownTableGeneratorTool: ToolDefinition = {
  ...tableGeneratorTool,
  aliasOf: 'table-generator',
  id: 'markdown-table-generator',
  name: 'Markdown Table Generator',
};
