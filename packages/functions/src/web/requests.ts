import { base64Encode, utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { parseExactJson, stringifyExactJson } from '../format';

export type HttpHeader = { name: string; value: string };

export type HttpRequest = {
  body?: string;
  headers: HttpHeader[];
  method: string;
  url: string;
};

export type HttpRequestOptions = {
  apiKeyLocation?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  authMode?: string;
  basicPassword?: string;
  basicUsername?: string;
  bearerToken?: string;
  body?: string;
  bodyMode?: string;
  headers?: string;
  method?: string;
  query?: string;
  rawContentType?: string;
  url: string;
};

export type RawHttpRequestOptions = { baseUrl?: string; scheme?: 'http' | 'https' };

const headerName = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function buildHttpRequest(options: HttpRequestOptions): HttpRequest {
  const method = normalizeMethod(options.method || 'GET');
  let url: URL;

  try {
    url = new URL(required(options.url, 'URL'));
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw webError(error instanceof Error ? error.message : String(error));
  }

  appendQueryParameters(url, options.query ?? '');
  const headers = parseHeaders(options.headers ?? '', 'Header');
  const body = buildBody(options, headers);

  applyAuthentication(url, headers, options);

  return { method, url: url.toString(), headers, body };
}

export function inspectRawHttpRequest(
  value: string,
  options: RawHttpRequestOptions = {},
): HttpRequest {
  required(value, 'Raw HTTP request');

  // Only the head is normalized: multipart delimiters need the body's CRLF byte for byte.
  const input = value.trimStart();
  const terminator = /\r?\n\r?\n/.exec(input);
  const head = terminator ? input.slice(0, terminator.index).trimEnd() : input.trimEnd();
  const body = terminator ? input.slice(terminator.index + terminator[0].length) : '';
  const [requestLine = '', ...headerLines] = head.split(/\r?\n/);
  const match = requestLine.match(/^([A-Z]+)\s+(\S+)\s+HTTP\/1\.[01]$/);

  if (!match) throw webError('Request line must use the form "METHOD target HTTP/1.1".');

  const headers = parseHeaders(headerLines.join('\n'), 'Header');
  const url = resolveRawTarget(match[2]!, headers, options);

  return { method: normalizeMethod(match[1]!), url, headers, ...(body.trim() ? { body } : {}) };
}

export function renderCurl(request: HttpRequest): string {
  // `-X HEAD` makes curl wait for a body that never comes; `--head` cannot carry a body.
  const method =
    request.method === 'HEAD' && request.body === undefined
      ? ['--head']
      : ['-X', shellQuote(request.method)];
  const parts = ['curl', '--globoff', ...method, shellQuote(request.url)];

  // curl drops `Name: ` and sends an empty header only for `Name;`.
  for (const { name, value } of request.headers)
    parts.push('-H', shellQuote(value ? `${name}: ${value}` : `${name};`));
  if (request.body !== undefined) parts.push('--data-raw', shellQuote(request.body));

  return parts.join(' ');
}

export function renderFetch(request: HttpRequest): string {
  const lines: string[] = [];
  const headers = request.headers.filter(
    (header) =>
      !['host', 'connection', 'content-length', 'transfer-encoding'].includes(
        header.name.toLowerCase(),
      ),
  );

  if (headers.length) {
    lines.push('const headers = new Headers();');
    for (const header of headers)
      lines.push(
        `headers.append(${JSON.stringify(header.name)}, ${JSON.stringify(header.value)});`,
      );
    lines.push('');
  }

  const options = [`  method: ${JSON.stringify(request.method)}`];

  if (headers.length) options.push('  headers');
  if (request.body !== undefined) options.push(`  body: ${JSON.stringify(request.body)}`);

  lines.push(
    `const response = await fetch(${JSON.stringify(request.url)}, {\n${options.join(',\n')}\n});`,
  );

  return lines.join('\n');
}

export function renderRawHttp(request: HttpRequest): string {
  const url = new URL(request.url);
  const headers = request.headers.filter(
    (header) => !['host', 'content-length'].includes(header.name.toLowerCase()),
  );
  const lines = [
    `${request.method} ${url.pathname}${url.search} HTTP/1.1`,
    `Host: ${url.host}`,
    ...headers.map((header) => `${header.name}: ${header.value}`),
  ];

  if (request.body !== undefined) lines.push(`Content-Length: ${utf8Bytes(request.body).length}`);

  return `${lines.join('\r\n')}\r\n\r\n${request.body ?? ''}`;
}

function buildBody(options: HttpRequestOptions, headers: HttpHeader[]): string | undefined {
  const mode = options.bodyMode || 'none';

  if (mode === 'none') return undefined;

  const source = required(options.body ?? '', mode === 'json' ? 'JSON body' : 'Request body');

  if (mode === 'json') {
    const body = stringifyExactJson(parseExactJson(source).value);

    addHeaderIfAbsent(headers, 'Content-Type', 'application/json');

    return body;
  }

  if (mode === 'form') {
    const body = parseFormBody(source).toString();

    addHeaderIfAbsent(headers, 'Content-Type', 'application/x-www-form-urlencoded');

    return body;
  }

  if (mode === 'raw') {
    if (options.rawContentType?.trim())
      addHeaderIfAbsent(headers, 'Content-Type', options.rawContentType.trim());

    return options.body ?? source;
  }

  throw webError('Body format is invalid.');
}

function applyAuthentication(url: URL, headers: HttpHeader[], options: HttpRequestOptions): void {
  switch (options.authMode || 'none') {
    case 'none':
      return;
    case 'bearer':
      addHeaderIfAbsent(
        headers,
        'Authorization',
        `Bearer ${required(options.bearerToken ?? '', 'Bearer token')}`,
      );

      return;

    case 'basic': {
      const username = required(options.basicUsername ?? '', 'Basic auth username');
      const password = options.basicPassword ?? '';

      addHeaderIfAbsent(
        headers,
        'Authorization',
        `Basic ${base64Encode(utf8Bytes(`${username}:${password}`))}`,
      );

      return;
    }

    case 'api-key': {
      const name = required(options.apiKeyName ?? '', 'API key name');
      const value = required(options.apiKeyValue ?? '', 'API key value');

      if (options.apiKeyLocation === 'query')
        appendSearch(url, new URLSearchParams([[name, value]]));
      else addHeaderIfAbsent(headers, name, value);

      return;
    }

    default:
      throw webError('Authentication mode is invalid.');
  }
}

function resolveRawTarget(
  target: string,
  headers: HttpHeader[],
  options: RawHttpRequestOptions,
): string {
  // Without "://", `example.com:443` would parse as a URL whose scheme is `example.com:`.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(target)) return absoluteUrl(target);

  if (!target.startsWith('/'))
    throw webError('Raw request target must be an absolute URL or begin with "/".');

  const base = options.baseUrl?.trim();

  if (base) {
    try {
      return new URL(target, base).toString();
    } catch {
      throw webError('Base URL is invalid.');
    }
  }

  const host = headers.find((header) => header.name.toLowerCase() === 'host')?.value;

  if (!host) throw webError('Raw relative requests need a Host header or base URL.');

  return absoluteUrl(`${options.scheme === 'http' ? 'http' : 'https'}://${host}${target}`);
}

function absoluteUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    throw webError(`Request URL is invalid: ${value}`);
  }
}

function parseHeaders(value: string, label: string): HttpHeader[] {
  if (!value.trim()) return [];

  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      if (/^\s/.test(line)) throw webError(`${label} folding is not supported: ${line}`);

      const separator = line.indexOf(':');
      const name = separator > 0 ? line.slice(0, separator).trim() : '';
      const headerValue = separator > 0 ? line.slice(separator + 1).trim() : '';

      if (!headerName.test(name)) throw webError(`Invalid ${label.toLowerCase()} line: ${line}`);

      return { name, value: headerValue };
    });
}

function appendQueryParameters(url: URL, value: string): void {
  if (!value.trim()) return;

  const parameters = new URLSearchParams();

  for (const line of value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((entry) => entry.trim())) {
    const separator = line.indexOf('=');

    if (separator < 1) throw webError(`Query parameter must use name=value: ${line}`);

    parameters.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  appendSearch(url, parameters);
}

// url.searchParams would re-serialize the query the caller already wrote.
function appendSearch(url: URL, parameters: URLSearchParams): void {
  url.search = url.search ? `${url.search}&${parameters.toString()}` : parameters.toString();
}

function parseFormBody(value: string): URLSearchParams {
  const parameters = new URLSearchParams();

  for (const line of value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((entry) => entry.trim())) {
    const separator = line.indexOf('=');

    if (separator < 1) throw webError(`Form field must use name=value: ${line}`);

    parameters.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  return parameters;
}

function addHeaderIfAbsent(headers: HttpHeader[], name: string, value: string): void {
  if (!headerName.test(name)) throw webError(`Header name "${name}" must be an HTTP token.`);
  if (/[\r\n]/.test(value)) throw webError(`Header "${name}" must not contain line breaks.`);
  if (!headers.some((header) => header.name.toLowerCase() === name.toLowerCase()))
    headers.push({ name, value });
}

function normalizeMethod(value: string): string {
  const method = value.trim().toUpperCase();

  if (!/^[A-Z]+$/.test(method)) throw webError('HTTP method is invalid.');

  return method;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function required(value: string, label: string): string {
  const input = value.trim();

  if (!input) throw webError(`${label} input is required.`);

  return input;
}

function webError(message: string): FunctionError {
  return new FunctionError('INVALID_HTTP_REQUEST', message);
}
