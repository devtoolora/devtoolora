import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, hasCredentials, identityOutput } from '../shared';

const targets: Record<string, { fileName: string; label: string; language: string }> = {
  go: { fileName: 'request.go', label: 'Go net/http', language: 'go' },
  java: { fileName: 'Main.java', label: 'Java HttpClient', language: 'java' },
  node: { fileName: 'request.js', label: 'Node.js fetch', language: 'javascript' },
  php: { fileName: 'request.php', label: 'PHP cURL', language: 'php' },
  python: { fileName: 'request.py', label: 'Python requests', language: 'python' },
};

export const curlToCodeTool: ToolDefinition = {
  id: 'curl-to-code',
  name: 'cURL to Code',
  category: 'Web/API',
  description:
    'Convert a cURL command into Python requests, Node.js fetch, Go net/http, PHP cURL or Java HttpClient code, keeping method, headers, body and redirect behavior. Nothing is sent.',
  samples: [
    {
      fields: { language: 'python' },
      label: 'POST JSON as Python',
      text: "curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Ada\"}'",
    },
    {
      fields: { language: 'node' },
      label: 'GET following redirects as Node.js',
      text: "curl -L 'https://example.com/'",
    },
    {
      fields: { language: 'go' },
      label: 'PUT with headers as Go',
      text: "curl -X PUT 'https://api.example.com/items/7' -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' --data-raw '{\"done\":true}'",
    },
    {
      fields: { language: 'php' },
      label: 'Form fields as PHP',
      text: "curl 'https://example.com/login' -d user=ada -d 'note=a b'",
    },
    {
      fields: { language: 'java' },
      label: 'DELETE as Java',
      text: "curl -X DELETE 'https://api.example.com/items/7'",
    },
    {
      fields: { language: 'php' },
      label: 'HEAD request as PHP',
      text: "curl -X HEAD -L 'https://example.com/'",
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'python',
      id: 'language',
      label: 'Language',
      options: ['python', 'node', 'go', 'php', 'java'].map((value) => ({
        label: targets[value]?.label ?? value,
        value,
      })),
      type: 'select',
    },
  ],
  keywords: [
    'curl',
    'curl to python',
    'curl to go',
    'curl to php',
    'curl to java',
    'code generator',
    'requests',
    'http client',
    'convert curl',
  ],
  relatedToolIds: ['curl-to-fetch', 'http-request-builder', 'raw-http-request-inspector'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => runCurlToCode(text, fields.language || 'python'),
};

function withLanguageDefault(id: string, name: string, language: string): ToolDefinition {
  return {
    ...curlToCodeTool,
    aliasOf: 'curl-to-code',
    fields: curlToCodeTool.fields?.map((entry) =>
      entry.id === 'language' ? { ...entry, defaultValue: language } : entry,
    ),
    id,
    name,
  };
}

export const curlToPythonTool = withLanguageDefault('curl-to-python', 'cURL to Python', 'python');
export const curlToGoTool = withLanguageDefault('curl-to-go', 'cURL to Go', 'go');
export const curlToPhpTool = withLanguageDefault('curl-to-php', 'cURL to PHP', 'php');
export const curlToJavaTool = withLanguageDefault('curl-to-java', 'cURL to Java', 'java');

function runCurlToCode(text: string, language: string): ToolResult {
  const { code, renderedHeaders, request } = withToolError(() =>
    webFunctions.renderCurlAsCode(text, language),
  );
  const target = targets[language];
  const headerCount = renderedHeaders;
  const bodyBytes = new TextEncoder().encode(request.body ?? '').length;
  const credentials = hasCredentials(request) ? ' Contains credentials; share with care.' : '';
  const summary = `${request.method} ${request.url} · ${headerCount} ${headerCount === 1 ? 'header' : 'headers'} · ${bodyBytes} body ${bodyBytes === 1 ? 'byte' : 'bytes'} · ${target?.label} · not sent.${credentials}`;

  return {
    ...identityOutput(code, target?.fileName ?? 'request.txt', summary, false),
    language: target?.language ?? 'plaintext',
  };
}
