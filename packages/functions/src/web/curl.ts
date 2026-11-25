import { readAnsiCQuote } from './ansiCQuote';
import { readLiteralFetch } from './literalFetch';
import { renderCurl, type HttpRequest } from './requests';
import { required, webError } from './webInput';

function splitCurlFlag(argument: string): { flag: string; inlineValue?: string } {
  const equals = argument.startsWith('--') ? argument.indexOf('=') : -1;

  if (equals >= 0)
    return { flag: argument.slice(0, equals), inlineValue: argument.slice(equals + 1) };
  if (/^-[XHd].+/.test(argument))
    return { flag: argument.slice(0, 2), inlineValue: argument.slice(2) };

  return { flag: argument };
}

interface CurlRequest {
  body: string | undefined;
  bodyKind: string;
  disableGlobbing: boolean;
  follow: boolean;
  headers: Array<[string, string]>;
  method: string;
  names: Set<string>;
  url: string;
}

const curlSwitches = [
  '-s',
  '--silent',
  '-S',
  '--show-error',
  '-L',
  '--location',
  '-g',
  '--globoff',
  '-I',
  '--head',
];
const curlDataFlags = ['-d', '--data', '--data-raw', '--data-binary', '--json'];

function readCurlHeader(header: string, names: Set<string>): [string, string] {
  const separator = header.indexOf(':');
  const name = header.slice(0, separator);
  const headerValue = header.slice(separator + 1).trim();

  if (
    separator <= 0 ||
    !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
    name === '__proto__' ||
    !headerValue ||
    /[^\t\x20-\x7E]/.test(headerValue) ||
    /[\r\n\u0000-\u0008\u000B-\u001F\u007F]/.test(header)
  )
    throw webError(
      'Provide a nonempty ASCII Name: value header; prototype setters, file headers and removal syntax are unsupported.',
    );
  if (names.has(name.toLowerCase()))
    throw webError(
      'Duplicate case-insensitive headers cannot be faithfully represented by this fetch-object converter.',
    );

  names.add(name.toLowerCase());

  return [name, headerValue];
}

function addCurlData(request: CurlRequest, flag: string, data: string): void {
  const { body, bodyKind } = request;

  if (flag !== '--data-raw' && data.startsWith('@'))
    throw webError('File and stdin request bodies are unsupported; no file is read.');
  if (
    body !== undefined &&
    (flag === '--data-binary' ||
      flag === '--json' ||
      bodyKind === '--data-binary' ||
      bodyKind === '--json')
  )
    throw webError('Repeated or mixed binary/JSON body flags are unsupported.');

  request.body = body === undefined ? data : `${body}&${data}`;
  request.bodyKind = flag;
}

function applyCurlSwitch(request: CurlRequest, flag: string): void {
  if (flag === '-L' || flag === '--location') request.follow = true;
  if (flag === '-g' || flag === '--globoff') request.disableGlobbing = true;
  if (flag === '-I' || flag === '--head') request.method = 'HEAD';
}

function parseCurlArguments(args: string[]): CurlRequest {
  const request: CurlRequest = {
    body: undefined,
    bodyKind: '',
    disableGlobbing: false,
    follow: false,
    headers: [],
    method: '',
    names: new Set(),
    url: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    const { flag, inlineValue } = splitCurlFlag(argument);

    if (/^-[sSLgI]{2,}$/.test(argument)) {
      for (const letter of argument.slice(1)) applyCurlSwitch(request, `-${letter}`);

      continue;
    }

    const readArgument = (): string => {
      const next = inlineValue ?? args[++index];

      if (next === undefined) throw webError(`${flag} requires a value.`);

      return next;
    };

    if (curlSwitches.includes(flag)) {
      if (inlineValue !== undefined) throw webError(`${flag} does not accept a value.`);

      applyCurlSwitch(request, flag);

      continue;
    }

    if (flag === '-X' || flag === '--request') {
      request.method = readArgument();
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(request.method))
        throw webError('Request method must be a nonempty HTTP token.');
    } else if (flag === '-H' || flag === '--header') {
      request.headers.push(readCurlHeader(readArgument(), request.names));
    } else if (curlDataFlags.includes(flag)) {
      addCurlData(request, flag, readArgument());
    } else if (flag === '--url' || !argument.startsWith('-')) {
      const nextUrl = flag === '--url' ? readArgument() : argument;

      if (request.url)
        throw webError('Multiple URLs are unsupported; convert one request at a time.');

      request.url = nextUrl;
    } else throw webError(`Unsupported cURL option: ${flag}. Nothing was silently omitted.`);
  }

  return request;
}

function assertFetchableUrl(url: string, disableGlobbing: boolean): void {
  if (!url) throw webError('Could not find a URL in the cURL command.');

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw webError('Provide one absolute HTTP(S) URL.');
  }

  if (
    !/^https?:\/\//i.test(url) ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    /[\s\\]/.test(url) ||
    parsed.username ||
    parsed.password
  )
    throw webError(
      'Use an absolute HTTP(S) URL without embedded credentials, whitespace or backslashes.',
    );
  // Read the raw text: the URL parser percent-encodes braces, and an IPv6 host has brackets.
  if (!disableGlobbing && /[{}\[\]]/.test(url.replace(/^https?:\/\/[^/?#]*/i, '')))
    throw webError(
      'URL glob patterns are unsupported; percent-encode literal braces or brackets, or use --globoff.',
    );
}

function finalizeCurlRequest(request: CurlRequest): void {
  const { body, bodyKind, headers, names } = request;

  request.method ||= body !== undefined ? 'POST' : 'GET';

  const { method } = request;

  if (['CONNECT', 'TRACE', 'TRACK'].includes(method.toUpperCase()))
    throw webError('This method is forbidden by Fetch.');
  if (
    ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'].includes(method.toUpperCase()) &&
    method !== method.toUpperCase()
  )
    throw webError(
      'Fetch normalizes standard method casing; use the uppercase method to avoid changing cURL semantics.',
    );
  if (['GET', 'HEAD'].includes(method.toUpperCase()) && body !== undefined)
    throw webError('Fetch cannot send a GET or HEAD body.');
  if (body !== undefined && !names.has('content-type'))
    headers.push([
      'Content-Type',
      bodyKind === '--json' ? 'application/json' : 'application/x-www-form-urlencoded',
    ]);
  if (bodyKind === '--json' && !names.has('accept')) headers.push(['Accept', 'application/json']);
}

function renderFetchCall({ follow, request }: { follow: boolean; request: HttpRequest }): string {
  const { body, headers, method, url } = request;
  const options: string[] = [
    `  method: ${JSON.stringify(method)}`,
    `  redirect: ${JSON.stringify(follow ? 'follow' : 'manual')}`,
  ];

  if (headers.length)
    options.push(
      `  headers: ${JSON.stringify(Object.fromEntries(headers.map((header) => [header.name, header.value])), null, 2).replace(/\n/g, '\n  ')}`,
    );
  if (body !== undefined) options.push(`  body: ${JSON.stringify(body)}`);

  const optionsBlock = options.length ? `, {\n${options.join(',\n')}\n}` : '';

  return `const response = await fetch(${JSON.stringify(url)}${optionsBlock});`;
}

export function parseCurlCommand(value: string): { follow: boolean; request: HttpRequest } {
  if (value.length > 65536) throw webError('cURL input exceeds 65,536 characters.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value))
    throw webError('Command contains unsupported control characters.');

  const tokens = splitCommand(required(value, 'cURL command'));

  if (tokens[0] !== 'curl' && !tokens[0]?.endsWith('/curl'))
    throw webError('Enter one POSIX-style curl command, without a shell wrapper.');

  const request = parseCurlArguments(tokens.slice(1));

  assertFetchableUrl(request.url, request.disableGlobbing);
  finalizeCurlRequest(request);

  return {
    follow: request.follow,
    request: {
      body: request.body,
      headers: request.headers.map(([name, headerValue]) => ({ name, value: headerValue })),
      method: request.method,
      url: request.url,
    },
  };
}

export function curlToFetch(value: string): string {
  return renderFetchCall(parseCurlCommand(value));
}

export function fetchToCurl(value: string): string {
  const { redirect, request } = readLiteralFetch(value);
  let command = renderCurl(request);

  if (request.method === 'POST' && request.body !== undefined)
    command = command.replace(" -X 'POST'", '');

  return redirect === 'follow' ? command.replace(/^curl /, 'curl --location ') : command;
}

function isShellSyntax(
  character: string,
  next: string,
  isQuoted: boolean,
  hasToken: boolean,
): boolean {
  return (
    character === '`' ||
    (character === '$' && /[({A-Za-z_0-9]/.test(next)) ||
    (character === '$' && !isQuoted && next === '"') ||
    (!isQuoted && /[;&|<>*?\[\]{}]/.test(character)) ||
    (!isQuoted && character === '~' && !hasToken)
  );
}

function splitCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote = '';
  let hasToken = false;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]!;

    if (quote === "'") {
      if (character === "'") quote = '';
      else current += character;

      continue;
    }

    if (character === '$' && !quote && command[index + 1] === "'") {
      const { end, text } = readAnsiCQuote(command, index + 2);

      current += text;
      hasToken = true;
      index = end;

      continue;
    }

    if (character === '\\') {
      if (index + 1 >= command.length) throw webError('Command ends with an incomplete escape.');

      const next = command[++index]!;

      if (next === '\n' || (next === '\r' && command[index + 1] === '\n')) {
        if (next === '\r') index += 1;

        continue;
      }

      if (quote === '"' && !['"', '\\', '$', '`'].includes(next)) current += '\\';

      current += next;
      hasToken = true;
    } else if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? '' : character;
      hasToken = true;
    } else if (/\s/.test(character) && !quote) {
      if (character === '\n' || character === '\r')
        throw webError(
          'Use backslash line continuations for a multiline command; separate commands are unsupported.',
        );

      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
    } else {
      if (isShellSyntax(character, command[index + 1] ?? '', quote !== '', hasToken))
        throw webError(
          'Shell expansion, command substitution, globbing and operators are unsupported; quote literal arguments.',
        );
      if (!quote && character === '#' && !hasToken)
        throw webError('Shell comments are unsupported.');

      current += character;
      hasToken = true;
    }
  }

  if (quote) throw webError('Command has an unterminated quote.');
  if (hasToken) tokens.push(current);

  return tokens;
}
