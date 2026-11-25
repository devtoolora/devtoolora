import { ToolDefinition } from '@devtoolora/core';
import { filterLogLines } from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { logOutput } from '../shared';

export const logFilterTool: ToolDefinition = {
  id: 'log-filter',
  name: 'Log Filter',
  category: 'Logs & Diagnostics',
  description: 'Keep log lines that match an include regex and avoid an exclude regex.',
  samples: [
    {
      fields: { excludePattern: 'healthcheck', flags: 'i', includePattern: 'warn|error' },
      label: 'Errors without health checks',
      text: 'INFO started\nWARN cache miss\nERROR database timeout\nERROR healthcheck failed',
    },
    {
      fields: { excludePattern: '', flags: '', includePattern: '^ERROR' },
      label: 'Anchored severity',
      text: 'ERROR demo\nINFO contains ERROR',
    },
    {
      fields: { excludePattern: 'DEBUG', flags: '', includePattern: '' },
      label: 'Exclude only',
      text: 'INFO demo\nDEBUG demo',
    },
    {
      fields: { excludePattern: '', flags: 'i', includePattern: 'request-42' },
      label: 'Request identifier',
      text: 'request-41 start\nrequest-42 finish',
    },
    {
      fields: { excludePattern: '', flags: '', includePattern: 'ERROR' },
      label: 'No matches',
      text: 'INFO demo',
    },
    {
      fields: { excludePattern: '', flags: '', includePattern: 'warn' },
      label: 'Case-sensitive',
      text: 'WARN demo\nwarn demo',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: ['browserWorker', 'vscode', 'desktop'],
  freshResults: true,
  isolatedWorker: true,
  sensitiveInput: true,
  fields: [
    { id: 'includePattern', label: 'Include pattern', type: 'text', placeholder: 'error|warn' },
    { id: 'excludePattern', label: 'Exclude pattern', type: 'text', placeholder: 'healthcheck' },
    { id: 'flags', label: 'Flags', type: 'text', defaultValue: 'i', placeholder: 'im' },
  ],
  keywords: ['logs', 'filter', 'grep', 'regex', 'include', 'exclude'],
  relatedToolIds: ['regex-test', 'json-lines-inspector', 'raw-log-redactor', 'text-statistics'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const output = filterLogLines(
        text,
        fields.includePattern ?? '',
        fields.excludePattern ?? '',
        fields.flags ?? 'i',
      );
      const lineCount = output ? output.replace(/\n$/, '').split('\n').length : 0;

      return logOutput(
        output,
        'filtered.log',
        'plaintext',
        `Matched ${lineCount} log line${lineCount === 1 ? '' : 's'} · contents are not redacted.`,
      );
    }),
};
