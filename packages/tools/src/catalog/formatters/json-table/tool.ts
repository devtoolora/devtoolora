import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { tabulateJsonDocument } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

export const jsonTableTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Inspect JSON records in a searchable table and export safe Markdown without rounding numbers.',
  fields: [
    {
      defaultValue: 'table',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Table preview', value: 'table' },
        { label: 'Markdown', value: 'markdown' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'json-table',
  inputKind: 'text',
  keywords: ['json records', 'table', 'markdown', 'dataset', 'search', 'exact numbers'],
  name: 'JSON Table',
  outputKind: 'markdown',
  relatedToolIds: ['json-query', 'json-tree', 'json-to-csv', 'csv-profiler', 'json-format'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = fields.output ?? 'table';

      if (output !== 'table' && output !== 'markdown')
        throw new ToolError('Choose Table preview or Markdown.');

      const table = tabulateJsonDocument(text);

      return {
        artifact: {
          base64: encodeBase64Text(table.markdown),
          fileName: 'json-table.md',
          mimeType: 'text/markdown;charset=utf-8',
        },
        jsonTable: output === 'table' ? { columns: table.columns, rows: table.rows } : undefined,
        language: 'markdown',
        summary: `${table.rows.length} rows · ${table.columns.length} data columns · exact JSON cells · export includes all records.`,
        text: table.markdown,
      };
    }),
  samples: [
    {
      fields: { output: 'table' },
      label: 'User records',
      text: '[{"id":1,"name":"Ada Lovelace","active":true},{"id":2,"name":"Grace Hopper","active":false}]',
    },
    {
      fields: { output: 'table' },
      label: 'Missing null and empty values',
      text: '[{"value":null},{"value":""},{"value":false},{"value":0},{"value":[]},{"value":{}},{"other":"present"}]',
    },
    {
      fields: { output: 'table' },
      label: 'Exact numbers and nested data',
      text: '[{"id":9007199254740993,"amount":1.00,"roles":["dev","admin"],"settings":{"theme":"dark"}},{"id":9007199254740995,"amount":1e400,"roles":[],"settings":{}}]',
    },
    {
      fields: { output: 'markdown' },
      label: 'Safe Markdown and Unicode',
      text: '[{"a|b":"<img src=x onerror=alert(1)>","":"Příliš žluťoučký 🐎","note":"Line one\\nLine two *not bold*"}]',
    },
    { fields: { output: 'table' }, label: 'Empty records', text: '[{},{}]' },
    { fields: { output: 'table' }, label: 'Empty dataset', text: '[]' },
  ],
  supportsSelection: true,
};
