import { FunctionError } from '../errors';

export type SelectorToken = {
  end: number;
  idStart?: boolean;
  kind: 'delim' | 'function' | 'hash' | 'ident' | 'number' | 'space' | 'string';
  start: number;
  value: string;
};

/** A selector-level error; `fatal` errors are never dropped by a forgiving :is()/:where() list. */
export class SelectorSyntaxError extends Error {
  constructor(
    message: string,
    readonly fatal = false,
  ) {
    super(message);
  }
}

const isSpace = (char: string | undefined) =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9';
const isHex = (char: string | undefined) =>
  isDigit(char) ||
  (char !== undefined && ((char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')));
const isNameStart = (char: string | undefined) =>
  char !== undefined &&
  ((char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    char === '_' ||
    char.charCodeAt(0) >= 0x80);
const isNameChar = (char: string | undefined) => isNameStart(char) || isDigit(char) || char === '-';
const isNewline = (char: string | undefined) => char === '\n' || char === '\r' || char === '\f';

function isEscape(source: string, index: number): boolean {
  return source[index] === '\\' && index + 1 < source.length && !isNewline(source[index + 1]);
}

function startsIdent(source: string, index: number): boolean {
  const char = source[index];

  if (char === '-')
    return (
      isNameStart(source[index + 1]) || source[index + 1] === '-' || isEscape(source, index + 1)
    );

  return isNameStart(char) || isEscape(source, index);
}

function startsNumber(source: string, index: number): boolean {
  const char = source[index];
  const next = source[index + 1];

  if (char === '+' || char === '-')
    return isDigit(next) || (next === '.' && isDigit(source[index + 2]));

  return isDigit(char) || (char === '.' && isDigit(next));
}

function readEscape(source: string, index: number): [string, number] {
  let cursor = index + 1;

  if (!isHex(source[cursor])) {
    const point = source.codePointAt(cursor) ?? 0xfffd;

    return [String.fromCodePoint(point), cursor + (point > 0xffff ? 2 : 1)];
  }

  let hex = '';

  while (hex.length < 6 && isHex(source[cursor])) hex += source[cursor++];

  if (source[cursor] === '\r' && source[cursor + 1] === '\n') cursor += 2;
  else if (isSpace(source[cursor])) cursor += 1;

  const point = Number.parseInt(hex, 16);
  const valid = point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff);

  return [String.fromCodePoint(valid ? point : 0xfffd), cursor];
}

function readName(source: string, index: number): [string, number] {
  let cursor = index;
  let name = '';

  while (cursor < source.length) {
    if (isEscape(source, cursor)) {
      const [text, next] = readEscape(source, cursor);

      name += text;
      cursor = next;
    } else if (isNameChar(source[cursor])) name += source[cursor++];
    else break;
  }

  return [name, cursor];
}

function readString(source: string, index: number): number {
  const quote = source[index];
  let cursor = index + 1;

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === quote) return cursor + 1;

    if (isNewline(char)) break;

    cursor += char === '\\' ? 2 : 1;
  }

  throw new SelectorSyntaxError('Unclosed string; add the closing quote.');
}

function readNumber(source: string, index: number): number {
  let cursor = index + (source[index] === '+' || source[index] === '-' ? 1 : 0);

  while (isDigit(source[cursor]) || source[cursor] === '.') cursor += 1;

  if (source[cursor] === '%') return cursor + 1;

  return startsIdent(source, cursor) ? readName(source, cursor)[1] : cursor;
}

function readToken(source: string, start: number): SelectorToken | number {
  const char = source[start];
  const token = (kind: SelectorToken['kind'], end: number, value = source.slice(start, end)) => ({
    end,
    kind,
    start,
    value,
  });

  if (char === '/' && source[start + 1] === '*') {
    const close = source.indexOf('*/', start + 2);

    if (close === -1) throw new SelectorSyntaxError('Unclosed comment; add */.');

    return close + 2;
  }

  if (isSpace(char)) {
    let end = start + 1;

    while (isSpace(source[end])) end += 1;

    return token('space', end, ' ');
  }

  if (char === '"' || char === "'") return token('string', readString(source, start));

  if (char === '#' && (isNameChar(source[start + 1]) || isEscape(source, start + 1))) {
    const [name, end] = readName(source, start + 1);

    return { ...token('hash', end, name), idStart: startsIdent(source, start + 1) };
  }

  if (startsNumber(source, start)) return token('number', readNumber(source, start));

  if (startsIdent(source, start)) {
    const [name, end] = readName(source, start);

    return source[end] === '(' ? token('function', end + 1, name) : token('ident', end, name);
  }

  const point = source.codePointAt(start) ?? 0;

  return token('delim', start + (point > 0xffff ? 2 : 1));
}

export function tokenizeSelector(input: string): SelectorToken[] {
  // CSS Syntax: a backslash at the end of the input reads as U+FFFD.
  const source = input.endsWith('\\') ? `${input.slice(0, -1)}\ufffd` : input;
  const tokens: SelectorToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const next = readToken(source, cursor);

    if (typeof next === 'number') cursor = next;
    else {
      tokens.push(next);
      cursor = next.end;
    }
  }

  return tokens;
}

export function splitSelectorList(
  source: string,
  { maxSelectorLength, maxSelectors }: { maxSelectorLength: number; maxSelectors: number },
): string[] {
  const parts: string[] = [];
  let start = 0;

  while (start < source.length) {
    const { end, next } = scanSelector(source, start, maxSelectorLength);
    const part = source.slice(start, end);

    if (hasContent(part)) parts.push(part);

    if (parts.length > maxSelectors)
      throw new FunctionError(
        'INVALID_CSS',
        `Selector lists are limited to ${maxSelectors} selectors.`,
      );

    start = next;
  }

  return parts;
}

function hasContent(part: string): boolean {
  for (let index = 0; index < part.length; index += 1) {
    if (part[index] === '/' && part[index + 1] === '*') {
      const close = part.indexOf('*/', index + 2);

      if (close === -1) return true;

      index = close + 1;
    } else if (!isSpace(part[index])) return true;
  }

  return false;
}

function scanSelector(
  source: string,
  start: number,
  maxLength: number,
): { end: number; next: number } {
  const closers: string[] = [];
  let firstNestedNewline = -1;
  let cursor = start;

  while (cursor < source.length && (firstNestedNewline === -1 || cursor - start <= maxLength)) {
    const char = source[cursor];

    if (closers.length === 0 && (char === ',' || isNewline(char)))
      return { end: cursor, next: cursor + 1 };

    if (isNewline(char) && firstNestedNewline === -1) firstNestedNewline = cursor;

    if (char === '(' || char === '[') closers.push(char === '(' ? ')' : ']');
    else if (char === closers[closers.length - 1]) {
      closers.pop();

      if (closers.length === 0) firstNestedNewline = -1;
    }

    cursor = skipOpaque(source, cursor);
  }

  if (firstNestedNewline !== -1) return { end: firstNestedNewline, next: firstNestedNewline + 1 };

  return { end: source.length, next: source.length };
}

function skipOpaque(source: string, index: number): number {
  const char = source[index];

  if (char === '\\') return index + 2;

  if (char === '/' && source[index + 1] === '*') {
    const close = source.indexOf('*/', index + 2);

    return close === -1 ? source.length : close + 2;
  }

  if (char !== '"' && char !== "'") return index + 1;

  let cursor = index + 1;

  while (cursor < source.length && source[cursor] !== char && !isNewline(source[cursor]))
    cursor += source[cursor] === '\\' ? 2 : 1;

  return source[cursor] === char ? cursor + 1 : cursor;
}

export class Cursor {
  constructor(
    readonly source: string,
    readonly tokens: SelectorToken[],
    public pos: number,
    readonly end: number,
  ) {}

  peek(offset = 0): SelectorToken | undefined {
    const index = this.pos + offset;

    return index < this.end ? this.tokens[index] : undefined;
  }

  skipSpace(): boolean {
    const start = this.pos;

    while (this.peek()?.kind === 'space') this.pos += 1;

    return this.pos > start;
  }
}

export const isDelim = (token: SelectorToken | undefined, value: string) =>
  token?.kind === 'delim' && token.value === value;

export function fail(message: string): never {
  throw new SelectorSyntaxError(message);
}

export function unexpected(cursor: Cursor, token: SelectorToken): never {
  return fail(`Unexpected "${cursor.source.slice(token.start, token.end)}" in the selector.`);
}

export function findClose(cursor: Cursor): number {
  let depth = 0;

  for (let index = cursor.pos; index < cursor.end; index += 1) {
    const token = cursor.tokens[index];

    if (token?.kind === 'function' || isDelim(token, '(')) depth += 1;
    else if (isDelim(token, ')')) {
      if (depth === 0) return index;

      depth -= 1;
    }
  }

  return -1;
}

function stripComments(text: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < text.length) {
    const open = text.indexOf('/*', cursor);

    if (open === -1) break;

    const close = text.indexOf('*/', open + 2);

    result += text.slice(cursor, open);
    cursor = close === -1 ? text.length : close + 2;
  }

  return result + text.slice(cursor);
}

export function isAnPlusB(text: string): boolean {
  const value = stripComments(text).toLowerCase();

  // ReDoS-safe: flat patterns without nested quantifiers, on at most 2,000 characters.
  return (
    value === 'odd' ||
    value === 'even' ||
    /^[+-]?\d+$/.test(value) ||
    /^[+-]?\d*n$/.test(value) ||
    /^[+-]?\d*n\s*[+-]\s*\d+$/.test(value)
  );
}

export const isCombinator = (token: SelectorToken | undefined) =>
  isDelim(token, '>') || isDelim(token, '+') || isDelim(token, '~');
export const isTypeName = (token: SelectorToken | undefined) =>
  token?.kind === 'ident' || isDelim(token, '*');

export function nthParts(cursor: Cursor, close: number): { of: number; text: string } {
  let of = -1;

  for (let index = cursor.pos + 1; index < close && of === -1; index += 1) {
    const token = cursor.tokens[index];

    if (token?.kind === 'ident' && token.value.toLowerCase() === 'of')
      of = cursor.tokens[index - 1]?.kind === 'space' ? index : -1;
  }

  const from = cursor.tokens[cursor.pos]?.start ?? 0;
  const to = cursor.tokens[of === -1 ? close : of]?.start ?? from;

  return { of, text: cursor.source.slice(from, to).trim() };
}
