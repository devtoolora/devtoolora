import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { compareJsonDocuments, type JsonDiffReport } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

function readableDiff(diff: JsonDiffReport): string {
  if (diff.equal) return 'No differences.';

  return diff.changes
    .map((entry) =>
      [
        `${entry.kind.charAt(0).toUpperCase()}${entry.kind.slice(1)} ${JSON.stringify(entry.pointer)}`,
        `Before: ${entry.before ?? 'Missing'}`,
        `After: ${entry.after ?? 'Missing'}`,
      ].join('\n'),
    )
    .join('\n\n');
}

export const jsonDiffTool: ToolDefinition = {
  autoRun: false,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Compare JSON structures with precise numbers, index-level array changes and clear before/after values.',
  fields: [
    {
      id: 'left',
      label: 'Left JSON',
      placeholder: '{"name":"before"}',
      required: true,
      rows: 10,
      type: 'textarea',
    },
    {
      id: 'right',
      label: 'Right JSON',
      placeholder: '{"name":"after"}',
      required: true,
      rows: 10,
      type: 'textarea',
    },
    {
      defaultValue: 'value',
      help: 'Value: 1.00 equals 1e0 and -0 equals 0. Exact token also detects spelling changes; strings always compare decoded content.',
      id: 'numbers',
      label: 'Number comparison',
      options: [
        { label: 'Numeric value', value: 'value' },
        { label: 'Exact token', value: 'token' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'text',
      id: 'report',
      label: 'Report',
      options: [
        { label: 'Visual / text', value: 'text' },
        { label: 'JSON report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'json-diff',
  inputKind: 'none',
  keywords: ['compare', 'difference', 'before after', 'json pointer', 'precise numbers'],
  name: 'JSON Diff',
  outputKind: 'text',
  relatedToolIds: ['json-format', 'json-tree', 'json-query', 'json-schema-validator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const numbers = fields.numbers ?? 'value';
      const report = fields.report ?? 'text';

      if (numbers !== 'value' && numbers !== 'token')
        throw new ToolError('Choose Numeric value or Exact token.');
      if (report !== 'text' && report !== 'json')
        throw new ToolError('Choose Visual / text or JSON report.');

      const diff = compareJsonDocuments(fields.left ?? '', fields.right ?? '', numbers);
      const text = report === 'json' ? JSON.stringify(diff, null, 2) : readableDiff(diff);

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: `json-diff.${report === 'json' ? 'json' : 'txt'}`,
          mimeType:
            report === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        ...(report === 'text' ? { jsonDiff: { changes: diff.changes } } : {}),
        language: report === 'json' ? 'json' : 'plaintext',
        summary: `${diff.added} added · ${diff.removed} removed · ${diff.changed} changed · ${numbers === 'value' ? 'exact numeric values' : 'exact number tokens'}.`,
        text,
      };
    }),
  samples: [
    {
      fields: {
        left: '{"id":1,"name":"Ada","role":"engineer"}',
        numbers: 'value',
        report: 'text',
        right: '{"id":1,"name":"Ada Lovelace","role":"lead engineer","active":true}',
      },
      label: 'Modified user profile',
    },
    {
      fields: {
        left: '{"name":"Ada","removed":null,"tags":["dev","admin"]}',
        numbers: 'value',
        report: 'text',
        right: '{"name":"Grace","added":null,"tags":["dev","editor","reviewer"]}',
      },
      label: 'Added removed and array index changes',
    },
    {
      fields: {
        left: '{"id":9007199254740992,"price":1.00}',
        numbers: 'value',
        report: 'text',
        right: '{"price":1e0,"id":9007199254740993}',
      },
      label: 'Precise IDs and equivalent decimals',
    },
    {
      fields: {
        left: '{"a/b~c":1,"":null}',
        numbers: 'value',
        report: 'json',
        right: '{"a/b~c":2,"":false}',
      },
      label: 'Escaped JSON Pointers',
    },
    {
      fields: {
        left: '{"a":1,"b":"\\u0061"}',
        numbers: 'value',
        report: 'text',
        right: '{"b":"a","a":10e-1}',
      },
      label: 'Equivalent reordered JSON',
    },
    {
      fields: {
        left: '{"text":"<img src=x onerror=alert(1)>"}',
        numbers: 'value',
        report: 'text',
        right: '{"text":"<script>alert(1)</script>"}',
      },
      label: 'HTML is only text',
    },
  ],
  supportsSelection: false,
};
