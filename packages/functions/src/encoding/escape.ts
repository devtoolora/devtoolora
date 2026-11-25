import { FunctionError } from '../errors/FunctionError';

export type EscapeLanguage =
  'csv' | 'java' | 'javascript' | 'json' | 'regex' | 'shell' | 'sql' | 'xml';

const maxChars = 1_000_000;
const regexSpecials = '\\^$.*+?()[]{}|/';
const simpleEscapes: Record<string, string> = {
  '"': '"',
  '/': '/',
  '\\': '\\',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};
const controlNames: Record<string, string> = {
  '\b': 'b',
  '\f': 'f',
  '\n': 'n',
  '\r': 'r',
  '\t': 't',
};
const xmlEntities = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['quot', '"'],
]);

function hex(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, '0');
}

function escapeCStyle(text: string, singleQuote: boolean): string {
  const pattern = singleQuote
    ? /["'\\\u0000-\u001f\u2028\u2029]/g
    : /["\\\u0000-\u001f\u2028\u2029]/g;

  return text.replace(pattern, (character) => {
    if (character === '"' || character === "'" || character === '\\') return `\\${character}`;

    const name = controlNames[character];

    return name ? `\\${name}` : `\\u${hex(character.charCodeAt(0), 4)}`;
  });
}

function invalidEscape(sequence: string, index: number): FunctionError {
  return new FunctionError(
    'INVALID_ESCAPE',
    `Invalid escape ${sequence} at position ${index + 1}.`,
  );
}

function decodeEscape(
  text: string,
  index: number,
  language: 'java' | 'javascript' | 'json',
): { consumed: number; value: string } {
  const key = text.charAt(index + 1);
  const script = language === 'javascript';
  const simple = simpleEscapes[key];

  if (simple !== undefined) return { consumed: 1, value: simple };
  if (key === "'" && language !== 'json') return { consumed: 1, value: "'" };
  if (key === 's' && language === 'java') return { consumed: 1, value: ' ' };
  if (key === 'v' && script) return { consumed: 1, value: '\v' };
  if (key === '0' && script && !/\d/.test(text.charAt(index + 2)))
    return { consumed: 1, value: '\0' };

  if (key === 'u') {
    if (script && text.charAt(index + 2) === '{') {
      const end = text.indexOf('}', index + 3);
      const digits = end === -1 ? '' : text.slice(index + 3, end);
      const code = /^[0-9a-fA-F]{1,8}$/.test(digits) ? parseInt(digits, 16) : Infinity;

      if (code > 0x10ffff) throw invalidEscape('\\u{', index);

      return { consumed: end - index, value: String.fromCodePoint(code) };
    }

    const digits = text.slice(index + 2, index + 6);

    if (!/^[0-9a-fA-F]{4}$/.test(digits)) throw invalidEscape('\\u', index);

    return { consumed: 5, value: String.fromCharCode(parseInt(digits, 16)) };
  }

  if (key === 'x' && script) {
    const digits = text.slice(index + 2, index + 4);

    if (!/^[0-9a-fA-F]{2}$/.test(digits)) throw invalidEscape('\\x', index);

    return { consumed: 3, value: String.fromCharCode(parseInt(digits, 16)) };
  }

  throw invalidEscape(`\\${key}`, index);
}

// A pasted line often ends in a newline, which must not hide the closing quote.
function withoutFinalNewline(text: string): string {
  return text.replace(/\r?\n$/, '');
}

function unescapeCStyle(text: string, language: 'java' | 'javascript' | 'json'): string {
  const quoted = language === 'javascript' ? /^(["']).*\1$/s : /^".*"$/s;
  const line = withoutFinalNewline(text);
  const closing = line.length - 1;
  let slashes = 0;

  while (line.charAt(closing - 1 - slashes) === '\\') slashes += 1;

  const body =
    line.length >= 2 && quoted.test(line) && slashes % 2 === 0 ? line.slice(1, -1) : text;
  let result = '';
  let index = 0;

  while (index < body.length) {
    const slash = body.indexOf('\\', index);

    if (slash === -1) break;

    const decoded = decodeEscape(body, slash, language);

    result += body.slice(index, slash) + decoded.value;
    index = slash + 1 + decoded.consumed;
  }

  return result + body.slice(index);
}

function decodeSqlBody(body: string): string {
  let result = '';

  for (let index = 0; index < body.length; index += 1) {
    const character = body.charAt(index);

    if (character === "'") {
      if (body.charAt(index + 1) !== "'")
        throw new FunctionError('INVALID_ESCAPE', `Unescaped ' at position ${index + 1}.`);

      index += 1;
    }

    result += character;
  }

  return result;
}

function unescapeSql(text: string): string {
  try {
    return decodeSqlBody(text);
  } catch (error) {
    const line = withoutFinalNewline(text);

    if (line.length < 2 || !line.startsWith("'") || !line.endsWith("'")) throw error;

    try {
      return decodeSqlBody(line.slice(1, -1));
    } catch {
      throw error;
    }
  }
}

function unescapeXml(text: string): string {
  return text.replace(
    /&(?:#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*)?;?/g,
    (entity, offset) => {
      const named = xmlEntities.get(entity.slice(1, -1));
      const numeric = /^&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));$/.exec(entity);
      const code = numeric ? parseInt(numeric[1] ?? numeric[2] ?? '', numeric[1] ? 16 : 10) : -1;

      if (entity.endsWith(';') && named !== undefined) return named;
      if (code >= 0 && code <= 0x10ffff) return String.fromCodePoint(code);

      throw new FunctionError(
        'INVALID_ESCAPE',
        `Unknown XML entity ${entity} at position ${offset + 1}.`,
      );
    },
  );
}

function unescapeRegex(text: string): string {
  return text.replace(/\\(.)/gs, (match, character: string) =>
    regexSpecials.includes(character) ? character : match,
  );
}

function unescapeCsv(text: string): string {
  const line = withoutFinalNewline(text);

  return line.length >= 2 && line.startsWith('"') && line.endsWith('"')
    ? line.slice(1, -1).replace(/""/g, '"')
    : text;
}

function shellError(message: string): FunctionError {
  return new FunctionError('INVALID_ESCAPE', message);
}

function readShellDouble(text: string, start: number): { end: number; value: string } {
  let value = '';
  let index = start + 1;

  while (index < text.length && text.charAt(index) !== '"') {
    const character = text.charAt(index);
    const next = text.charAt(index + 1);

    if (character === '$' || character === '`')
      throw shellError(`Shell unescape does not expand $ or backticks (position ${index + 1}).`);

    if (character === '\\' && '$`"\\\n'.includes(next) && next !== '') {
      value += next === '\n' ? '' : next;
      index += 2;
    } else {
      value += character;
      index += 1;
    }
  }

  if (index >= text.length) throw shellError(`Unterminated " quote at position ${start + 1}.`);

  return { end: index + 1, value };
}

function unescapeShell(text: string): string {
  const input = text.trim();
  let result = '';
  let index = 0;

  while (index < input.length) {
    const character = input.charAt(index);

    if (/\s/.test(character)) throw shellError('Input contains more than one shell word.');

    if (character === "'") {
      const end = input.indexOf("'", index + 1);

      if (end === -1) throw shellError(`Unterminated ' quote at position ${index + 1}.`);

      result += input.slice(index + 1, end);
      index = end + 1;
    } else if (character === '"') {
      const double = readShellDouble(input, index);

      result += double.value;
      index = double.end;
    } else if (character === '$' || character === '`') {
      throw shellError(`Shell unescape does not expand $ or backticks (position ${index + 1}).`);
    } else if (character === '\\') {
      if (index + 1 >= input.length)
        throw shellError(`Trailing backslash at position ${index + 1}.`);

      result += input.charAt(index + 1) === '\n' ? '' : input.charAt(index + 1);
      index += 2;
    } else {
      result += character;
      index += 1;
    }
  }

  return result;
}

function assertSize(text: string): void {
  if (text.length > maxChars)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');
}

export function escapeString(
  text: string,
  language: EscapeLanguage,
  options: { quotes?: boolean } = {},
): string {
  assertSize(text);

  const quote = language === 'sql' ? "'" : '"';
  let escaped: string;

  switch (language) {
    case 'csv':
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    case 'regex':
      return text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
    case 'shell':
      return `'${text.replace(/'/g, "'\\''")}'`;
    case 'sql':
      escaped = text.replace(/'/g, "''");

      break;
    case 'xml':
      return text.replace(
        /[&<>"']/g,
        (c) => `&${{ '"': 'quot', "'": 'apos', '&': 'amp', '<': 'lt', '>': 'gt' }[c]};`,
      );
    default:
      escaped = escapeCStyle(text, language === 'javascript');
  }

  return options.quotes ? `${quote}${escaped}${quote}` : escaped;
}

export function unescapeString(text: string, language: EscapeLanguage): string {
  assertSize(text);

  switch (language) {
    case 'csv':
      return unescapeCsv(text);
    case 'regex':
      return unescapeRegex(text);
    case 'shell':
      return unescapeShell(text);
    case 'sql':
      return unescapeSql(text);
    case 'xml':
      return unescapeXml(text);
    default:
      return unescapeCStyle(text, language);
  }
}
