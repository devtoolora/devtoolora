import { FunctionError } from '../errors';
import { requiredText } from './shared';

export interface CssFormatOptions {
  indent: 2 | 4 | 'tab';
  mode: 'format' | 'minify';
}

export interface CssFormatResult {
  rules: number;
  text: string;
}

type CssToken = {
  start: number;
  text: string;
  type: ',' | ':' | ';' | '{' | '}' | 'comment' | 'gap' | 'other' | 'string' | 'ws';
};

const maxDepth = 100;
const maxLength = 5_000_000;
const singles = new Set([',', ':', ';', '{', '}']);
const runStop = /[\s"',:;{}]/;

function position(input: string, offset: number): string {
  const before = input.slice(0, offset).split('\n');

  return `line ${before.length}, column ${(before.at(-1)?.length ?? 0) + 1}`;
}

function fail(input: string, offset: number, message: string): never {
  throw new FunctionError('INVALID_CSS', `${message} at ${position(input, offset)}.`);
}

function scanString(input: string, start: number): number {
  const quote = input.charAt(start);
  let index = start + 1;

  while (index < input.length && input.charAt(index) !== quote) {
    if (input.charAt(index) === '\n') fail(input, start, 'Unterminated string');

    index += input.charAt(index) === '\\' ? 2 : 1;
  }

  if (index >= input.length) fail(input, start, 'Unterminated string');

  return index + 1;
}

function scanRun(input: string, start: number): number {
  let index = start;

  while (
    index < input.length &&
    (input.charAt(index) === '\\' || !runStop.test(input.charAt(index)))
  ) {
    if (input.charAt(index) === '/' && input.charAt(index + 1) === '*') break;

    index += input.charAt(index) === '\\' ? 2 : 1;
    if (
      input.slice(index - 4, index).toLowerCase() === 'url(' &&
      !/^\s*["']/.test(input.slice(index, index + 64))
    )
      return scanUrl(input, start, index);
  }

  return Math.min(index, input.length);
}

function scanUrl(input: string, start: number, from: number): number {
  let index = from;

  while (index < input.length && input.charAt(index) !== ')')
    index += input.charAt(index) === '\\' ? 2 : 1;
  if (index >= input.length) fail(input, start, 'Unterminated url()');

  return index + 1;
}

function nextEnd(input: string, index: number): [CssToken['type'], number] {
  const char = input.charAt(index);

  if (/\s/.test(char))
    return ['ws', index + (/^\s+/.exec(input.slice(index, index + 4096))?.[0].length ?? 1)];
  if (char === '/' && input.charAt(index + 1) === '*') {
    const end = input.indexOf('*/', index + 2);

    if (end < 0) fail(input, index, 'Unterminated comment');

    return ['comment', end + 2];
  }
  if (char === '"' || char === "'") return ['string', scanString(input, index)];
  if (singles.has(char)) return [char as CssToken['type'], index + 1];

  return ['other', scanRun(input, index)];
}

export function tokenizeCss(input: string): CssToken[] {
  const tokens: CssToken[] = [];
  let index = 0;

  while (index < input.length) {
    const [type, end] = nextEnd(input, index);

    tokens.push({ start: index, text: input.slice(index, end), type });
    index = end;
  }

  return tokens;
}

function isCustomProperty(buffer: CssToken[]): boolean {
  const first = buffer.find((token) => token.type !== 'ws');

  return Boolean(first?.text.startsWith('--')) && buffer.some((token) => token.type === ':');
}

function joinBuffer(buffer: CssToken[], isDeclaration: boolean, minify: boolean): string {
  const colon =
    isDeclaration && !buffer.find((token) => token.type !== 'ws')?.text.startsWith('@')
      ? buffer.findIndex((token) => token.type === ':')
      : -1;
  const isTight = (token: CssToken | undefined, index: number): boolean =>
    !token || index === colon || (minify && token.type === ',');
  let text = '';

  buffer.forEach((token, index) => {
    if (token.type === 'ws') {
      if (buffer[index - 1]?.type === 'ws') return;
      if (!isTight(buffer[index - 1], index - 1) && !isTight(buffer[index + 1], index + 1))
        text += ' ';
    } else if (token.type === 'gap') {
      const [before, after] = [buffer[index - 1], buffer[index + 1]];

      if (before && after && after.type !== 'ws') text += '/**/';
    } else if (index === colon) text += minify ? ':' : ': ';
    else text += token.text;
  });

  return text.trim();
}

export function formatCss(input: string, options: CssFormatOptions): CssFormatResult {
  if (input.length > maxLength)
    throw new FunctionError('CSS_TOO_LARGE', 'CSS input is limited to 5,000,000 characters.');
  if (options.indent !== 2 && options.indent !== 4 && options.indent !== 'tab')
    throw new FunctionError('INVALID_CSS_OPTIONS', 'Choose 2 spaces, 4 spaces or tabs.');
  if (options.mode !== 'format' && options.mode !== 'minify')
    throw new FunctionError('INVALID_CSS_OPTIONS', 'Choose Format or Minify.');

  requiredText(input, 'CSS');

  const source = input;
  const minify = options.mode === 'minify';
  const unit = options.indent === 'tab' ? '\t' : ' '.repeat(options.indent);
  const opens: number[] = [];
  const out: string[] = [];
  let buffer: CssToken[] = [];
  const rawOpens: number[] = [];
  let rules = 0;
  const line = (text: string, depth = opens.length) =>
    out.push(minify ? text : `${unit.repeat(depth)}${text}\n`);

  const flush = (suffix: string) => {
    const text = joinBuffer(buffer, true, minify);

    buffer = [];
    if (text) line(`${text}${suffix}`);
  };

  for (const token of tokenizeCss(source)) {
    // A `{…}` inside a custom property value is raw value text, not a nested rule.
    if (token.type === '{' && (rawOpens.length || isCustomProperty(buffer))) {
      rawOpens.push(token.start);
      buffer.push(token);
    } else if (token.type === '}' && rawOpens.length) {
      rawOpens.pop();
      buffer.push(token);
    } else if (rawOpens.length) buffer.push(token);
    else if (token.type === 'comment') {
      const isKept = !minify || token.text.startsWith('/*!');

      if (!buffer.some((item) => item.type !== 'ws')) {
        if (isKept) line(token.text);
      } else if (isKept) buffer.push(token);
      else if (buffer.at(-1)?.type !== 'ws') buffer.push({ ...token, text: '', type: 'gap' });
    } else if (token.type === '{') {
      if (opens.length >= maxDepth)
        throw new FunctionError('CSS_LIMIT', 'CSS formatting supports up to 100 nesting levels.');

      line(`${joinBuffer(buffer, false, minify)}${minify ? '{' : ' {'}`);
      buffer = [];
      opens.push(token.start);
      rules += 1;
    } else if (token.type === ';') flush(';');
    else if (token.type === '}') {
      if (!opens.length) fail(source, token.start, 'Unexpected }');

      flush(minify ? '' : ';');
      const last = out.at(-1);

      if (minify && last?.endsWith(';')) out[out.length - 1] = last.slice(0, -1);

      opens.pop();
      line('}');
    } else buffer.push(token);
  }

  const unclosed = rawOpens.at(-1) ?? opens.at(-1);

  if (unclosed !== undefined) fail(source, unclosed, 'Unclosed block');

  flush(minify ? '' : ';');

  return { rules, text: out.join('') };
}
