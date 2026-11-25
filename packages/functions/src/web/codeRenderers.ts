import { curlToFetch, parseCurlCommand } from './curl';
import type { HttpHeader, HttpRequest } from './requests';
import { webError } from './webInput';

export type CodeLanguage = 'go' | 'java' | 'node' | 'php' | 'python';

const clientHeaders = ['host', 'content-length'];
const javaHeaders = [...clientHeaders, 'connection', 'expect', 'upgrade'];

export function renderPythonRequests(
  request: HttpRequest,
  options: { dropComment?: boolean; follow?: boolean } = {},
): string {
  const { headers, notes } = pythonHeaders(request.headers);
  const dropped = options.dropComment ? splitHeaders(request.headers, clientHeaders).dropped : [];
  const lines = [
    'import requests',
    '',
    ...(dropped.length ? [`# Dropped headers the client sets itself: ${dropped.join(', ')}`] : []),
    ...notes,
    'response = requests.request(',
    `    ${pythonString(request.method)},`,
    `    ${pythonString(request.url)},`,
  ];

  if (headers.length) {
    lines.push('    headers={');
    for (const header of headers)
      lines.push(`        ${pythonString(header.name)}: ${pythonString(header.value)},`);
    lines.push('    },');
  }

  if (request.body !== undefined)
    lines.push(`    data=${pythonString(request.body)}.encode("utf-8"),`);

  if (options.follow === false) lines.push('    allow_redirects=False,');

  lines.push('    timeout=30,', ')', 'print(response.status_code)', 'print(response.text)');

  return lines.join('\n');
}

/**
 * requests takes a dict, which holds one value per case-insensitive name. Repeated fields are
 * combined as RFC 9110 allows: Cookie pairs with "; " (RFC 6265), other fields with ", ".
 * Set-Cookie values can contain commas, so they cannot be combined and only the last is kept.
 */
function pythonHeaders(source: HttpHeader[]): { headers: HttpHeader[]; notes: string[] } {
  const groups = new Map<string, { name: string; values: string[] }>();

  for (const header of source) {
    const key = header.name.toLowerCase();

    if (key === 'host' || key === 'content-length') continue;

    const group = groups.get(key);

    if (group) group.values.push(header.value);
    else groups.set(key, { name: header.name, values: [header.value] });
  }

  const combined: string[] = [];
  const notes: string[] = [];
  const headers = [...groups].map(([key, { name, values }]) => {
    if (values.length === 1) return { name, value: values[0] ?? '' };

    if (key === 'set-cookie') {
      notes.push(
        `# requests sends one value per header name, and Set-Cookie values cannot be combined, so only the last of ${values.length} ${name} headers is sent.`,
      );

      return { name, value: values[values.length - 1] ?? '' };
    }

    combined.push(name);
    const nonEmpty = values.filter((value) => value !== '');

    return { name, value: nonEmpty.join(key === 'cookie' ? '; ' : ', ') };
  });

  if (combined.length) {
    const names =
      combined.length === 1
        ? combined[0]
        : `${combined.slice(0, -1).join(', ')} and ${combined[combined.length - 1]}`;

    notes.unshift(
      `# requests sends one value per header name, so repeated ${names} headers are combined.`,
    );
  }

  return { headers, notes };
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

const escapes: Record<string, string> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '"': '\\"',
  '\\': '\\\\',
};

function quoted(value: string, control: (code: number) => string, dollar = false): string {
  const body = value.replace(/[\u0000-\u001F\u007F"\\$]/g, (character) => {
    if (character === '$') return dollar ? '\\$' : character;

    return escapes[character] ?? control(character.charCodeAt(0));
  });

  return `"${body}"`;
}

const hex = (width: number, prefix: string) => (code: number) =>
  `${prefix}${code.toString(16).padStart(width, '0')}`;
const goString = (value: string) => quoted(value, hex(2, '\\x'));
const phpString = (value: string) => quoted(value, hex(2, '\\x'), true);
const javaString = (value: string) => quoted(value, hex(4, '\\u'));

function splitHeaders(
  headers: HttpHeader[],
  dropped: string[],
): { dropped: string[]; kept: HttpHeader[] } {
  const isDropped = (header: HttpHeader) => dropped.includes(header.name.toLowerCase());

  return {
    dropped: headers.filter(isDropped).map((header) => header.name),
    kept: headers.filter((header) => !isDropped(header)),
  };
}

const droppedNote = (names: string[], indent: string): string[] =>
  names.length ? [`${indent}// Dropped headers the client sets itself: ${names.join(', ')}`] : [];

function renderGoHttp(request: HttpRequest, follow: boolean): string {
  const { dropped, kept } = splitHeaders(request.headers, clientHeaders);
  const hasBody = request.body !== undefined;
  const lines = [
    'package main',
    '',
    'import (',
    '\t"fmt"',
    '\t"io"',
    '\t"net/http"',
    ...(hasBody ? ['\t"strings"'] : []),
    ')',
    '',
    'func main() {',
    ...(hasBody ? [`\tbody := strings.NewReader(${goString(request.body ?? '')})`] : []),
    ...droppedNote(dropped, '\t'),
    `\treq, err := http.NewRequest(${goString(request.method)}, ${goString(request.url)}, ${hasBody ? 'body' : 'nil'})`,
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    ...kept.map(
      (header) => `\treq.Header.Add(${goString(header.name)}, ${goString(header.value)})`,
    ),
    ...(follow
      ? ['\tclient := &http.Client{}']
      : [
          '\tclient := &http.Client{',
          '\t\tCheckRedirect: func(req *http.Request, via []*http.Request) error {',
          '\t\t\treturn http.ErrUseLastResponse',
          '\t\t},',
          '\t}',
        ]),
    '\tresp, err := client.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer resp.Body.Close()',
    '\tdata, err := io.ReadAll(resp.Body)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tfmt.Println(resp.StatusCode)',
    '\tfmt.Println(string(data))',
    '}',
  ];

  return lines.join('\n');
}

function phpMethodOption(method: string, hasBody: boolean): string[] {
  if (method === 'GET') return [];
  // CURLOPT_POST without a body would send chunked encoding and a form Content-Type.
  if (method === 'POST' && hasBody) return ['curl_setopt($ch, CURLOPT_POST, true);'];
  if (method === 'HEAD') return ['curl_setopt($ch, CURLOPT_NOBODY, true);'];

  return [`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpString(method)});`];
}

function renderPhpCurl(request: HttpRequest, follow: boolean): string {
  const { dropped, kept } = splitHeaders(request.headers, clientHeaders);
  const lines = [
    '<?php',
    ...droppedNote(dropped, ''),
    `$ch = curl_init(${phpString(request.url)});`,
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
    ...(follow ? ['curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);'] : []),
    ...phpMethodOption(request.method, request.body !== undefined),
    ...(kept.length
      ? [
          'curl_setopt($ch, CURLOPT_HTTPHEADER, [',
          ...kept.map((header) => `    ${phpString(`${header.name}: ${header.value}`)},`),
          ']);',
        ]
      : []),
    ...(request.body === undefined
      ? []
      : [`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpString(request.body)});`]),
    '$response = curl_exec($ch);',
    'if ($response === false) {',
    '    throw new RuntimeException(curl_error($ch));',
    '}',
    'echo curl_getinfo($ch, CURLINFO_RESPONSE_CODE), "\\n";',
    'echo $response;',
    'curl_close($ch);',
  ];

  return lines.join('\n');
}

function javaMethodLine(request: HttpRequest): string {
  const publishers = 'HttpRequest.BodyPublishers';

  if (request.body !== undefined)
    return `.method(${javaString(request.method)}, ${publishers}.ofString(${javaString(request.body)}))`;
  if (request.method === 'GET') return '.GET()';

  return `.method(${javaString(request.method)}, ${publishers}.noBody())`;
}

// java.net.URI throws on literal brackets and braces, which curl -g sends; the host may be IPv6.
function javaUriText(url: string): string {
  return url.replace(/^(https?:\/\/[^/?#]*)(.*)$/is, (_match, authority: string, rest: string) => {
    return authority + rest.replace(/[{}[\]]/g, encodeURIComponent);
  });
}

function renderJavaHttpClient(request: HttpRequest, follow: boolean): string {
  const { dropped, kept } = splitHeaders(request.headers, javaHeaders);
  const lines = [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws Exception {',
    '        HttpClient client = HttpClient.newBuilder()',
    `            .followRedirects(HttpClient.Redirect.${follow ? 'NORMAL' : 'NEVER'})`,
    '            .build();',
    ...droppedNote(dropped, '        '),
    '        HttpRequest request = HttpRequest.newBuilder()',
    `            .uri(URI.create(${javaString(javaUriText(request.url))}))`,
    ...kept.map(
      (header) => `            .header(${javaString(header.name)}, ${javaString(header.value)})`,
    ),
    `            ${javaMethodLine(request)}`,
    '            .build();',
    '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
    '        System.out.println(response.statusCode());',
    '        System.out.println(response.body());',
    '    }',
    '}',
  ];

  return lines.join('\n');
}

const droppedByLanguage: Record<CodeLanguage, string[]> = {
  go: clientHeaders,
  java: javaHeaders,
  node: [],
  php: clientHeaders,
  python: clientHeaders,
};

const isCodeLanguage = (language: string): language is CodeLanguage =>
  Object.hasOwn(droppedByLanguage, language);

export function renderCurlAsCode(
  value: string,
  language: string,
): { code: string; follow: boolean; renderedHeaders: number; request: HttpRequest } {
  if (!isCodeLanguage(language)) throw webError('Language must be python, node, go, php or java.');

  const { follow, request } = parseCurlCommand(value);
  const renderers: Record<CodeLanguage, () => string> = {
    go: () => renderGoHttp(request, follow),
    java: () => renderJavaHttpClient(request, follow),
    node: () => curlToFetch(value),
    php: () => renderPhpCurl(request, follow),
    python: () => renderPythonRequests(request, { dropComment: true, follow }),
  };

  return {
    code: renderers[language](),
    follow,
    renderedHeaders: splitHeaders(request.headers, droppedByLanguage[language]).kept.length,
    request,
  };
}
