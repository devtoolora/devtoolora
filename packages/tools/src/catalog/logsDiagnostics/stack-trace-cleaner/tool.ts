import { ToolDefinition } from '@devtoolora/core';
import { cleanStackTrace } from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, logOutput } from '../shared';

export const stackTraceCleanerTool: ToolDefinition = {
  id: 'stack-trace-cleaner',
  name: 'Stack Trace Cleaner',
  category: 'Logs & Diagnostics',
  description: 'Clean JavaScript, TypeScript and Python stack traces into concise frames.',
  samples: [
    {
      label: 'Node stack',
      text: 'TypeError: demo\n    at parse (/app/a.ts:12:9)\n    at main (/app/b.ts:48:3)',
    },
    {
      label: 'Python traceback',
      text: 'Traceback (most recent call last):\n  File "app.py", line 10, in run\nValueError: demo',
    },
    {
      label: 'Duplicate adjacent frames',
      text: 'Error: demo\n at run (/app/a.ts:1:2)\n at run (/app/a.ts:1:2)',
    },
    {
      label: 'Nonadjacent repeated frames',
      text: 'Error: demo\n at a (/app/a.ts:1:2)\n at b (/app/b.ts:2:3)\n at a (/app/a.ts:1:2)',
    },
    {
      label: 'Mixed frame order',
      text: 'Error: demo\n at a (/app/a.ts:1:2)\n File "app.py", line 2, in run\n at b (/app/b.ts:3:4)',
    },
    { label: 'Windows line endings', text: 'Error: demo\r\n at run (/app/a.ts:1:2)\r\n' },
    {
      label: 'Frames without function names',
      text: 'Error: demo\n    at /app/server.js:10:5\n    at file:///app/x.mjs:3:1',
    },
  ],
  inputKind: 'text',
  outputKind: 'markdown',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  keywords: ['stack trace', 'traceback', 'javascript', 'typescript', 'python', 'error'],
  relatedToolIds: ['log-filter', 'raw-log-redactor', 'regex-test', 'text-statistics'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() =>
      logOutput(
        cleanStackTrace(text),
        'stack-trace.md',
        'markdown',
        'Recognized frames in source order · paths and exception messages are not redacted.',
      ),
    ),
};
