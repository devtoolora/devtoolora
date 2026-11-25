import { FunctionError } from '../errors';
import type { HttpHeader, HttpRequest } from './requests';

interface FetchOptions {
  body?: string;
  headers?: HttpHeader[];
  method?: string;
  redirect?: string;
}

export interface LiteralFetchRequest {
  redirect: 'follow' | 'manual';
  request: HttpRequest;
}

export function readLiteralFetch(source: string): LiteralFetchRequest {
  if (source.length > 65536) throw error('Fetch input exceeds 65,536 characters.');

  const { options, url } = new LiteralReader(source).read();
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw error(
      'Use an absolute HTTP(S) URL; a relative URL requires unavailable runtime context.',
    );
  }

  if (
    !/^https?:\/\//i.test(url) ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    /[\s\\]/.test(url)
  )
    throw error(
      'Use an absolute HTTP(S) URL without embedded credentials, whitespace or backslashes.',
    );

  const originalMethod = options.method ?? 'GET';

  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(originalMethod))
    throw error('Method must be a nonempty HTTP token.');

  const upper = originalMethod.toUpperCase();

  if (['CONNECT', 'TRACE', 'TRACK'].includes(upper))
    throw error('This method is forbidden by Fetch.');

  const method = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'].includes(upper)
    ? upper
    : originalMethod;

  if (['GET', 'HEAD'].includes(method) && options.body !== undefined)
    throw error('Fetch cannot send a GET or HEAD body, even an empty string.');

  const redirect = options.redirect ?? 'follow';

  if (redirect !== 'follow' && redirect !== 'manual')
    throw error(
      'Only follow/manual redirect modes can be represented; redirect:error is unsupported.',
    );

  const headers = options.headers ?? [];

  if (
    options.body !== undefined &&
    !headers.some((header) => header.name.toLowerCase() === 'content-type')
  )
    headers.push({ name: 'Content-Type', value: 'text/plain;charset=UTF-8' });

  return { redirect, request: { body: options.body, headers, method, url } };
}

class LiteralReader {
  private index = 0;

  constructor(private readonly source: string) {}

  read(): { options: FetchOptions; url: string } {
    const prefix = this.source.match(
      /^\s*(?:(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*)?(?:await\s+)?fetch\s*\(/,
    );

    if (!prefix)
      throw error(
        'Provide one literal fetch(...) call, optionally assigned to a simple variable or awaited.',
      );

    this.index = prefix[0].length;
    const url = this.string();
    let options: FetchOptions = {};

    if (this.take(',')) {
      if (!this.peek(')')) options = this.options();

      this.take(',');
    }

    this.expect(')');
    this.take(';');
    this.space();
    if (this.index !== this.source.length)
      throw this.syntax('Chained calls, extra statements and expressions are unsupported');

    return { options, url };
  }

  private options(): FetchOptions {
    this.expect('{');
    const options: FetchOptions = {};
    const names = new Set<string>();

    while (!this.take('}')) {
      const name = this.key();

      if (names.has(name)) throw this.syntax('Duplicate option names are unsupported');

      names.add(name);
      this.expect(':');

      switch (name) {
        case 'body': {
          this.space();
          if (this.source.slice(this.index, this.index + 4) === 'null') this.index += 4;
          else options.body = this.string();

          break;
        }

        case 'headers':
          options.headers = this.headers();

          break;
        case 'method':
          options.method = this.string();

          break;
        case 'redirect':
          options.redirect = this.string();

          break;
        default:
          throw error(`Unsupported Fetch option: ${name}. Nothing was silently omitted.`);
      }

      if (this.take('}')) return options;

      this.expect(',');
    }

    return options;
  }

  private headers(): HttpHeader[] {
    this.expect('{');
    const headers: HttpHeader[] = [];
    const names = new Set<string>();

    while (!this.take('}')) {
      const name = this.key();

      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || name === '__proto__')
        throw error('Use literal HTTP token header names; prototype setters are unsupported.');
      if (names.has(name.toLowerCase()))
        throw error('Duplicate case-insensitive header names are unsupported.');

      names.add(name.toLowerCase());
      this.expect(':');
      const value = this.string()
        .replace(/^[\t ]+/, '')
        .replace(/(?<![\t ])[\t ]+$/, '');

      if (!value || /[^\t\x20-\x7E]/.test(value))
        throw error(
          'Use nonempty ASCII header values; empty, non-ASCII and control values are unsupported by this literal conversion.',
        );

      headers.push({ name, value });
      if (this.take('}')) return headers;

      this.expect(',');
    }

    return headers;
  }

  private key(): string {
    this.space();
    if (this.peek('"') || this.peek("'")) return this.string();

    const identifier = this.source.slice(this.index).match(/^[A-Za-z_$][\w$]*/);

    if (!identifier)
      throw this.syntax('Use a literal property name; spreads and computed keys are unsupported');

    this.index += identifier[0].length;

    return identifier[0];
  }

  private string(): string {
    this.space();
    const quote = this.source[this.index++];

    if (quote !== '"' && quote !== "'" && quote !== '`')
      throw this.syntax('Expected a string literal, not a variable or expression');

    let result = '';

    while (this.index < this.source.length) {
      const character = this.source[this.index++];

      if (character === quote) {
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uD800-\uDFFF]/u.test(result))
          throw error('The literal contains unsupported controls or unpaired Unicode surrogates.');

        return result;
      }

      if (quote === '`' && character === '$' && this.source[this.index] === '{')
        throw error('Template interpolation is unsupported and is never evaluated.');

      if (character === '\\') result += this.escape();
      else if (character === '\n' || character === '\r') {
        if (quote !== '`') throw this.syntax('Unescaped newline in a quoted string');
        if (character === '\r' && this.source[this.index] === '\n') this.index += 1;

        result += '\n';
      } else result += character;
    }

    throw this.syntax('Unterminated string literal');
  }

  private escape(): string {
    const escape = this.source[this.index++];

    if (escape === '\n') return '';

    if (escape === '\r') {
      if (this.source[this.index] === '\n') this.index += 1;

      return '';
    }

    if (escape !== undefined && Object.hasOwn(simpleEscapes, escape)) return simpleEscapes[escape]!;
    if (escape === 'u' && this.source[this.index] === '{') return this.codePointEscape();
    if (escape === 'x' || escape === 'u') return this.hexEscape(escape === 'x' ? 2 : 4);

    throw this.syntax('Unsupported string escape');
  }

  private codePointEscape(): string {
    this.index += 1;
    const end = this.source.indexOf('}', this.index);
    const digits = this.source.slice(this.index, end);

    if (end < 0 || !/^[0-9a-f]{1,6}$/i.test(digits) || parseInt(digits, 16) > 0x10ffff)
      throw this.syntax('Invalid Unicode code-point escape');

    this.index = end + 1;

    return String.fromCodePoint(parseInt(digits, 16));
  }

  private hexEscape(length: number): string {
    const digits = this.source.slice(this.index, this.index + length);

    if (digits.length !== length || !/^[0-9a-f]+$/i.test(digits))
      throw this.syntax('Invalid hexadecimal escape');

    this.index += length;

    return String.fromCharCode(parseInt(digits, 16));
  }

  private space(): void {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }
  private peek(character: string): boolean {
    this.space();

    return this.source[this.index] === character;
  }
  private take(character: string): boolean {
    if (!this.peek(character)) return false;

    this.index += 1;

    return true;
  }
  private expect(character: string): void {
    if (!this.take(character)) throw this.syntax(`Expected ${character}`);
  }
  private syntax(message: string): FunctionError {
    return error(`${message} at character ${this.index + 1}.`);
  }
}

const simpleEscapes: Record<string, string> = {
  '"': '"',
  "'": "'",
  '\\': '\\',
  '`': '`',
  $: '$',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

function error(message: string): FunctionError {
  return new FunctionError('INVALID_WEB_INPUT', message);
}
