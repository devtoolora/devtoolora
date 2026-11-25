import { ToolDefinition, ToolError, ToolField, ToolResult } from '@devtoolora/core';
import { utf8Bytes } from '@devtoolora/functions/binary';
import { processJsonDocument } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import * as webFunctions from '@devtoolora/functions/web';
import type { HttpRequest } from '@devtoolora/functions/web';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const requestExportField: ToolField = {
  defaultValue: 'all',
  id: 'export',
  label: 'Export',
  options: [
    { label: 'All', value: 'all' },
    { label: 'cURL', value: 'curl' },
    { label: 'fetch', value: 'fetch' },
    { label: 'Raw HTTP', value: 'raw' },
    { label: 'Python', value: 'python' },
  ],
  presentation: 'segmented',
  type: 'select',
};

export function identityOutput(
  text: string,
  fileName: string,
  summary: string,
  isJson: boolean,
): ToolResult {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName,
      mimeType: isJson ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
    },
    ...(isJson
      ? {
          jsonTree: {
            nodes: processJsonDocument(text, { collectTree: true, mode: 'minify' }).nodes,
          },
        }
      : {}),
    language: isJson ? 'json' : 'plaintext',
    summary,
    text,
  };
}

const markdownFenceLanguages: Record<string, string> = {
  javascript: 'js',
  shellscript: 'sh',
};

const requestExports: Record<
  string,
  {
    fileName: string;
    label: string;
    language: string;
    mimeType: string;
    render(request: HttpRequest): string;
  }
> = {
  curl: {
    fileName: 'request.sh',
    label: 'cURL',
    language: 'shellscript',
    mimeType: 'text/x-shellscript',
    render: webFunctions.renderCurl,
  },
  fetch: {
    fileName: 'request.js',
    label: 'JavaScript fetch',
    language: 'javascript',
    mimeType: 'text/javascript',
    render: webFunctions.renderFetch,
  },
  python: {
    fileName: 'request.py',
    label: 'Python requests',
    language: 'python',
    mimeType: 'text/x-python',
    render: webFunctions.renderPythonRequests,
  },
  raw: {
    fileName: 'request.http',
    label: 'Raw HTTP/1.1',
    language: 'http',
    mimeType: 'message/http',
    render: webFunctions.renderRawHttp,
  },
};

function hasUrlCredentials(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(url);
}

export function hasCredentials(request: HttpRequest): boolean {
  return (
    request.headers.some((header) =>
      /^(?:authorization|cookie|proxy-authorization|x-api-key)$/i.test(header.name),
    ) ||
    /[?&](?:api_?key|token|access_token|key)=/i.test(request.url) ||
    hasUrlCredentials(request.url)
  );
}

export function renderRequest(
  request: HttpRequest,
  exportFormat = 'all',
  generatedAuth: boolean,
): ToolResult {
  const target = exportFormat === 'all' ? undefined : requestExports[exportFormat];

  if (exportFormat !== 'all' && !target)
    throw new ToolError('Choose All, cURL, fetch, Raw HTTP or Python.');

  const credentials = generatedAuth || hasCredentials(request);
  const bodyBytes = utf8Bytes(request.body ?? '').length;
  const fetchBody =
    request.body !== undefined && (request.method === 'GET' || request.method === 'HEAD')
      ? ` fetch rejects a body on ${request.method}.`
      : '';
  const fetchUrl = hasUrlCredentials(request.url)
    ? ' fetch rejects a URL with embedded credentials.'
    : '';
  const summary = `${request.method} ${request.url} · ${request.headers.length} ${request.headers.length === 1 ? 'header' : 'headers'} · ${bodyBytes} body ${bodyBytes === 1 ? 'byte' : 'bytes'} · not sent.${credentials ? ' Contains credentials; share with care.' : ''}${fetchBody}${fetchUrl}`;

  if (target) {
    const text = target.render(request);

    return {
      artifact: {
        base64: encodeBase64Text(text),
        fileName: target.fileName,
        mimeType: `${target.mimeType};charset=utf-8`,
      },
      language: target.language,
      summary,
      text,
    };
  }

  return renderAllExports(request, summary, bodyBytes);
}

function renderAllExports(request: HttpRequest, summary: string, bodyBytes: number): ToolResult {
  const overview = {
    method: request.method,
    url: request.url,
    headers: request.headers.map((header) => header.name),
    bodyBytes,
  };
  const sections = Object.values(requestExports).map((target) => [
    `## ${target.label}`,
    '',
    `\`\`\`${markdownFenceLanguages[target.language] ?? target.language}`,
    target.render(request).replace(/\r\n/g, '\n'),
    '```',
  ]);
  const text = [
    '# HTTP Request',
    '',
    '```json',
    JSON.stringify(overview, null, 2),
    '```',
    ...sections.flatMap((section) => ['', ...section]),
  ].join('\n');

  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: 'request.md',
      mimeType: 'text/markdown;charset=utf-8',
    },
    language: 'markdown',
    summary,
    text,
  };
}
