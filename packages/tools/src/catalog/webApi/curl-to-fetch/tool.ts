import { ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { conversionPair } from '../../../adapters/conversionPair';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const [curlFetchTool, fetchCurlTool] = conversionPair({
  aliasId: 'fetch-to-curl',
  aliasName: 'Fetch to cURL',
  capabilities: browserSafeCapabilities,
  category: 'Web/API',
  decode: { run: ({ text }) => fetchToCurl(text) },
  decodedLabel: 'cURL',
  description:
    'Convert a cURL command into a JavaScript fetch call, or a fetch call back into a cURL command, keeping method, headers, body and redirects.',
  encode: { run: ({ text }) => curlToFetch(text) },
  encodedLabel: 'fetch',
  id: 'curl-to-fetch',
  inputKind: 'text',
  keywords: [
    'curl',
    'fetch',
    'curl to fetch',
    'fetch to curl',
    'javascript',
    'http request',
    'converter',
    'shell',
  ],
  name: 'cURL ↔ Fetch Converter',
  outputKind: 'text',
  relatedToolIds: [
    'http-request-builder',
    'raw-http-request-inspector',
    'http-headers-parser',
    'secret-redactor',
  ],
  resultActions: ['copy', 'scratch', 'save'],
  sensitiveInput: true,
  supportsSelection: true,
  samples: [
    {
      fields: { mode: 'encode' },
      label: 'cURL → fetch: GET request',
      text: "curl 'https://example.com/items'",
    },
    {
      fields: { mode: 'encode' },
      label: 'cURL → fetch: POST JSON',
      text: "curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Ada\"}'",
    },
    {
      fields: { mode: 'encode' },
      label: 'cURL → fetch: Empty POST body',
      text: "curl 'https://example.com/' --data-raw ''",
    },
    {
      fields: { mode: 'encode' },
      label: 'cURL → fetch: Repeated form fields',
      text: "curl 'https://example.com/' -d a=1 -d b=2",
    },
    {
      fields: { mode: 'encode' },
      label: 'cURL → fetch: JSON defaults',
      text: 'curl \'https://example.com/\' --json \'{"name":"Ada"}\'',
    },
    {
      fields: { mode: 'encode' },
      label: 'cURL → fetch: Follow redirects',
      text: "curl -L 'https://example.com/' -H 'X-Demo: sample'",
    },
    {
      fields: { mode: 'decode' },
      label: 'fetch → cURL: POST JSON',
      text: 'fetch("https://api.example.com/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\\"name\\":\\"Ada\\"}" })',
    },
    {
      fields: { mode: 'decode' },
      label: 'fetch → cURL: Empty POST body',
      text: 'fetch("https://example.com/", { method: "POST", body: "" })',
    },
    {
      fields: { mode: 'decode' },
      label: 'fetch → cURL: Manual redirects',
      text: 'await fetch("https://example.com/", { redirect: "manual" })',
    },
    {
      fields: { mode: 'decode' },
      label: 'fetch → cURL: Apostrophe and Unicode',
      text: 'fetch("https://example.com/", { method: "POST", body: "O\'Reilly \\u{1F600}" })',
    },
    {
      fields: { mode: 'decode' },
      label: 'fetch → cURL: Null body',
      text: 'const response = await fetch(`https://example.com/`, { body: null });',
    },
  ],
});

export const curlToFetchTool = curlFetchTool;
export const fetchToCurlTool = fetchCurlTool;

function curlToFetch(text: string): ToolResult {
  return {
    ...identityOutput(
      withToolError(() => webFunctions.curlToFetch(text)),
      'fetch-request.js',
      'Literal request converted · credentials retained · no request sent.',
      false,
    ),
    language: 'javascript',
  };
}

function fetchToCurl(text: string): ToolResult {
  return {
    ...identityOutput(
      withToolError(() => webFunctions.fetchToCurl(text)),
      'curl-request.sh',
      'POSIX command generated · credentials retained · not executed.',
      false,
    ),
    language: 'shellscript',
  };
}
