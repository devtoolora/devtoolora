import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const httpHeadersParserTool: ToolDefinition = {
  id: 'http-headers-parser',
  keywords: ['headers', 'request headers', 'response headers', 'set-cookie', 'raw http'],
  name: 'HTTP Headers Parser',
  category: 'Web/API',
  description: 'Parse raw HTTP request or response headers into structured JSON.',
  samples: [
    {
      label: 'Response headers',
      text: 'HTTP/2 200 OK\ncontent-type: application/json\nset-cookie: a=demo\nset-cookie: b=demo',
    },
    {
      label: 'Absolute request target',
      text: 'GET http://example.com/path HTTP/1.1\nHost: example.com',
    },
    { label: 'Case-insensitive duplicates', text: 'X-Trace: a\nx-trace: b' },
    { label: 'Empty field value', text: 'X-Empty:\nAccept: application/json' },
    { label: 'Prototype-like field names', text: '__proto__: demo\nconstructor: sample' },
    {
      label: 'Windows copied block',
      text: 'HTTP/1.1 204 No Content\r\nCache-Control: no-store\r\n\r\n',
    },
  ],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  relatedToolIds: ['raw-http-request-inspector', 'raw-log-redactor', 'http-request-builder'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) => parseHttpHeaders(text),
};

function parseHttpHeaders(text: string): ToolResult {
  return identityOutput(
    JSON.stringify(
      withToolError(() => webFunctions.parseHttpHeaders(text)),
      null,
      2,
    ),
    'http-headers.json',
    'Repeated fields preserved · credentials are not redacted · no network request.',
    true,
  );
}
