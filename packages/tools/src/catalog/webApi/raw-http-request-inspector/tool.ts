import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, requestExportField, renderRequest } from '../shared';

export const rawHttpRequestInspectorTool: ToolDefinition = {
  id: 'raw-http-request-inspector',
  name: 'Raw HTTP Request Inspector',
  category: 'Web/API',
  description:
    'Parse a copied HTTP/1.x request, resolve its URL from Host or a base URL, and export cURL, fetch, raw HTTP or Python code.',
  samples: [
    {
      fields: { baseUrl: '', export: 'all', scheme: 'https' },
      label: 'POST with a JSON body',
      text: 'POST /items?dryRun=true HTTP/1.1\nHost: api.example.com\nContent-Type: application/json\nAccept: application/json\n\n{"name":"Ada"}',
    },
    {
      fields: { baseUrl: '', export: 'curl', scheme: 'https' },
      label: 'GET with Authorization (cURL)',
      text: 'GET /v1/orders?status=open HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer demo-token\nAccept: application/json',
    },
    {
      fields: { baseUrl: '', export: 'fetch', scheme: 'https' },
      label: 'Absolute-form proxy request (fetch)',
      text: 'GET https://api.example.com/health HTTP/1.1\nHost: api.example.com\nUser-Agent: curl/8.7.1\nAccept: */*',
    },
    {
      fields: { baseUrl: '', export: 'python', scheme: 'https' },
      label: 'Form submission (Python)',
      text: 'POST /login HTTP/1.1\nHost: app.example.com\nContent-Type: application/x-www-form-urlencoded\n\nusername=ada&remember=true',
    },
    {
      fields: { baseUrl: '', export: 'all', scheme: 'https' },
      label: 'Repeated headers',
      text: 'GET /trace HTTP/1.1\nHost: api.example.com\nX-Trace: first\nX-Trace: second\nCookie: theme=dark',
    },
    {
      fields: { baseUrl: 'http://localhost:8080', export: 'raw', scheme: 'http' },
      label: 'Local server with a base URL (raw HTTP)',
      text: 'PATCH /items/42 HTTP/1.1\nHost: api.example.com\nContent-Type: application/json\n\n{"done":true}',
    },
  ],
  inputKind: 'text',
  inputPresentation: {
    label: 'Raw HTTP request',
    placeholder: 'POST /items HTTP/1.1\nHost: api.example.com\n\n{"name":"Ada"}',
  },
  outputKind: 'markdown',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'https',
      id: 'scheme',
      label: 'Default scheme',
      options: [
        { label: 'HTTPS', value: 'https' },
        { label: 'HTTP', value: 'http' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'Overrides the Host header for relative targets.',
      id: 'baseUrl',
      label: 'Base URL',
      placeholder: 'https://api.example.com',
      type: 'text',
    },
    requestExportField,
  ],
  keywords: [
    'raw http',
    'http request parser',
    'request inspector',
    'curl export',
    'fetch export',
    'burp',
    'mitmproxy',
    '.http file',
  ],
  relatedToolIds: ['http-request-builder', 'http-headers-parser', 'curl-to-fetch'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) => inspectRawHttpRequest(text, fields),
};

function inspectRawHttpRequest(text: string, fields: Record<string, string>): ToolResult {
  return renderRequest(
    withToolError(() =>
      webFunctions.inspectRawHttpRequest(text, {
        scheme: fields.scheme === 'http' ? 'http' : 'https',
        baseUrl: fields.baseUrl,
      }),
    ),
    fields.export,
    false,
  );
}
