import { ToolDefinition } from '@devtoolora/core';
import { inspectJsonLines } from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, logOutput } from '../shared';

export const jsonLinesInspectorTool: ToolDefinition = {
  id: 'json-lines-inspector',
  name: 'JSON Lines Inspector',
  category: 'Logs & Diagnostics',
  description: 'Inspect JSONL records, malformed lines and top-level field presence.',
  samples: [
    {
      label: 'Two event objects',
      text: '{"level":"info","duration":12}\n{"level":"error","message":"demo"}',
    },
    { label: 'Missing fields', text: '{"id":1,"optional":true}\n{"id":2}' },
    { label: 'Mixed types', text: '{"value":1}\n{"value":"one"}\n{"value":null}' },
    { label: 'Nested fields', text: '{"tags":["demo"],"context":{"id":1}}' },
    { label: 'Malformed with blank line', text: '{"id":1}\n\nnot json' },
    { label: 'Non-object records', text: 'null\n[]\n{"id":1}' },
  ],
  inputKind: 'text',
  outputKind: 'markdown',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  keywords: ['jsonl', 'ndjson', 'logs', 'structured logs', 'inspect'],
  relatedToolIds: [
    'json-format',
    'json-tree',
    'log-filter',
    'raw-log-redactor',
    'jsonl-dataset-validator',
  ],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() =>
      logOutput(
        inspectJsonLines(text),
        'json-lines-report.md',
        'markdown',
        'Object-only JSONL profile · nested values and application schemas are not validated.',
      ),
    ),
};
