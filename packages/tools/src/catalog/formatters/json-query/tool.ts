import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { queryJsonDocument } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

export const jsonQueryTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Extract exact JSON values using a simple path or JSON Pointer copied from Tree and Diff.',
  fields: [
    {
      defaultValue: 'path',
      id: 'syntax',
      label: 'Path syntax',
      options: [
        { label: 'Simple path', value: 'path' },
        { label: 'JSON Pointer', value: 'pointer' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'Simple path: $.users[0].name. JSON Pointer: /users/0/name; leave empty for its root. Pointer whitespace is significant.',
      id: 'path',
      label: 'Path',
      placeholder: '$.users[0].name or /users/0/name',
      rows: 2,
      type: 'textarea',
    },
    {
      defaultValue: 'value',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Selected value', value: 'value' },
        { label: 'Query report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'json-query',
  inputKind: 'text',
  keywords: ['extract', 'selector', 'json pointer', 'jsonpath', 'nested property'],
  name: 'JSON Query',
  outputKind: 'json',
  relatedToolIds: ['json-tree', 'json-diff', 'json-format', 'json-schema-validator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const syntax = fields.syntax ?? 'path';
      const report = fields.report ?? 'value';

      if (syntax !== 'path' && syntax !== 'pointer')
        throw new ToolError('Choose Simple path or JSON Pointer.');
      if (report !== 'value' && report !== 'json')
        throw new ToolError('Choose Selected value or Query report.');

      const selected = queryJsonDocument(text, fields.path ?? '', syntax);
      const output =
        report === 'json'
          ? JSON.stringify(
              { pointer: selected.pointer, type: selected.type, valueJson: selected.text },
              null,
              2,
            )
          : selected.text;

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: report === 'json' ? 'json-query-report.json' : 'selected.json',
          mimeType: 'application/json;charset=utf-8',
        },
        language: 'json',
        resultActions:
          report === 'json'
            ? ['copy', 'scratch', 'save']
            : ['copy', 'replace', 'insert', 'scratch', 'save'],
        summary: `Extracted ${selected.type} · pointer ${JSON.stringify(selected.pointer)} · exact JSON tokens retained.`,
        text: output,
      };
    }),
  samples: [
    {
      fields: { path: 'store.books[0].title', report: 'value', syntax: 'path' },
      label: 'Query first book title',
      text: '{"store":{"books":[{"title":"Sayings of the Century","price":8.95},{"title":"Sword of Honour","price":12.99}]}}',
    },
    {
      fields: { path: '/a.b/a~1b~0c/', report: 'value', syntax: 'pointer' },
      label: 'Pointer from Tree or Diff',
      text: '{"a.b":{"a/b~c":{"":9007199254740993}}}',
    },
    {
      fields: { path: '$["a.b"]["Příliš žluťoučký"]', report: 'json', syntax: 'path' },
      label: 'Quoted punctuation and Unicode keys',
      text: '{"a.b":{"Příliš žluťoučký":[1.00,1e400,"\\u0061"]}}',
    },
    {
      fields: { path: '', report: 'value', syntax: 'pointer' },
      label: 'Whole document',
      text: '{"empty":[],"settings":{},"nothing":null,"zero":0,"off":false,"text":""}',
    },
    {
      fields: { path: '/', report: 'value', syntax: 'pointer' },
      label: 'Empty key is not the root',
      text: '{"":null,"other":false}',
    },
    {
      fields: { path: "$['user']['name']", report: 'value', syntax: 'path' },
      label: 'Single-quoted bracket keys',
      text: '{"user":{"name":"Ada Lovelace"}}',
    },
  ],
  supportsSelection: true,
};
