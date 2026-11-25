import { FunctionError } from '../errors';
import { JsonSyntaxError, processJsonDocument } from './jsonDocument';
import { requiredText } from './shared';

export interface JsoncToJsonOptions {
  dialect: 'json5' | 'jsonc';
  indent: 'tab' | 2 | 4;
}

export interface JsoncToJsonResult {
  comments: number;
  duplicateKeys: number;
  text: string;
}

interface ScanState {
  beforeComma: string;
  comments: number;
  dialect: JsoncToJsonOptions['dialect'];
  index: number;
  input: string;
  lastComma: number;
  lastSignificant: string;
  out: string[];
  starts: number[];
}

const maxLength = 5_000_000;
const identifierPattern = new RegExp(
  String.raw`(?:[\p{ID_Start}$_]|\\u[0-9a-fA-F]{4})(?:[\p{ID_Continue}$\u200C\u200D]|\\u[0-9a-fA-F]{4})*`,
  'uy',
);
const decodedIdentifier = new RegExp(
  String.raw`^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$`,
  'u',
);
const json5WhiteSpace = new RegExp(String.raw`[\v\f\u00A0\u2028\u2029\uFEFF\p{Zs}]`, 'u');
const json5NumberPattern =
  /[+-]?(?:0[xX][0-9a-fA-F]+|Infinity|NaN|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/y;
const lineBreak = new RegExp(String.raw`\r\n|[\n\r\u2028\u2029]`, 'y');
const simpleEscapes: Record<string, string> = {
  '0': '\0',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

const bom = String.fromCharCode(0xfeff);

function location(input: string, offset: number): string {
  const before = input.slice(0, offset).split(/\r\n|\r|\n/);
  const skipped = before.length === 1 && input.startsWith(bom) ? 1 : 0;

  return `line ${before.length}, column ${(before.at(-1)?.length ?? 0) + 1 - skipped}`;
}

function fail(state: ScanState, offset: number, message: string): never {
  throw new FunctionError('INVALID_JSON', `${message} at ${location(state.input, offset)}.`);
}

// A rewritten piece (quoted key, decoded string) is longer than its token, so clamp into the token.
function sourceOffset(state: ScanState, offset: number): number {
  let at = 0;

  for (const [index, piece] of state.out.entries()) {
    const start = state.starts[index] ?? 0;
    const end = state.starts[index + 1] ?? state.input.length;

    if (offset < at + piece.length) return Math.min(start + offset - at, end - 1);

    at += piece.length;
  }

  return state.input.length;
}

function formatJson(
  state: ScanState,
  options: JsoncToJsonOptions,
): ReturnType<typeof processJsonDocument> {
  try {
    // The input cap already bounds size; rewriting may lengthen it, and 5,000,000 characters hold
    // at most 2,500,000 values.
    return processJsonDocument(state.out.join(''), {
      indentation: String(options.indent) as '2' | '4' | 'tab',
      limits: { characters: Number.POSITIVE_INFINITY, values: 2_500_000 },
      mode: 'format',
    });
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) throw error;

    const offset = sourceOffset(state, error.offset);

    throw new FunctionError(
      'INVALID_JSON',
      `Invalid JSON at ${location(state.input, offset)} (offset ${offset}): ${error.reason}`,
    );
  }
}

function emit(state: ScanState, piece: string): void {
  if (piece.trim()) {
    if (piece === ',') state.beforeComma = state.lastSignificant;

    state.lastComma = piece === ',' ? state.out.length : -1;
    state.lastSignificant = piece;
  }

  state.out.push(piece);
}

// Only a comma that follows a value is a trailing comma; `[,]` and `[1,,]` stay invalid.
function closeContainer(state: ScanState): void {
  if (state.lastComma >= 0 && !['', ',', '[', '{'].includes(state.beforeComma))
    state.out[state.lastComma] = ' ';
}

function nextSignificant(input: string, from: number): string {
  let index = from;

  while (index < input.length) {
    const char = input.charAt(index);
    const next = input.charAt(index + 1);

    const blockEnd = char === '/' && next === '*' ? input.indexOf('*/', index + 2) : -2;

    if (blockEnd === -1) return '';
    if (blockEnd >= 0) index = blockEnd + 2;
    else if (char === '/' && next === '/') index = input.slice(index).search(/[\r\n]|$/) + index;
    else if (/\s/.test(char)) index += 1;
    else return char;
  }

  return '';
}

// Blank comments instead of removing them, so strict-JSON parse errors keep the source lines.
function scanComment(state: ScanState): void {
  const { index, input } = state;
  const block = input.charAt(index + 1) === '*';
  const end = block
    ? input.indexOf('*/', index + 2)
    : input.slice(index).search(/[\r\n]|$/) + index;

  if (block && end < 0) fail(state, index, 'Unterminated comment');

  const stop = block ? end + 2 : end;

  state.out.push(input.slice(index, stop).replace(/[^\r\n]/g, ' '));
  state.comments += 1;
  state.index = stop;
}

function readEscape(state: ScanState, at: number): [string, number] {
  const { input } = state;
  const next = input.charAt(at);

  lineBreak.lastIndex = at;
  if (lineBreak.exec(input)) return ['', lineBreak.lastIndex];
  if (/[1-9]/.test(next) || (next === '0' && /\d/.test(input.charAt(at + 1))))
    fail(state, at - 1, 'Octal escape is not valid JSON5');
  if (next === 'x' || next === 'u') {
    const size = next === 'x' ? 2 : 4;
    const hex = input.slice(at + 1, at + 1 + size);

    if (!new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex)) fail(state, at - 1, 'Invalid escape');

    return [String.fromCharCode(parseInt(hex, 16)), at + 1 + size];
  }

  return [simpleEscapes[next] ?? next, at + 1];
}

function scanString(state: ScanState): void {
  const { index: start, input } = state;
  const quote = input.charAt(start);
  const decode = state.dialect === 'json5';
  let value = '';
  let index = start + 1;

  if (quote === "'" && !decode) fail(state, start, 'Single-quoted strings need JSON5 mode');

  while (index < input.length && input.charAt(index) !== quote) {
    const char = input.charAt(index);

    if (char === '\n' || char === '\r') fail(state, start, 'Unterminated string');
    if (char === '\\' && decode) {
      const [decoded, next] = readEscape(state, index + 1);

      value += decoded;
      index = next;
    } else {
      const size = char === '\\' ? 2 : 1;

      value += input.slice(index, index + size);
      index += size;
    }
  }

  if (index >= input.length) fail(state, start, 'Unterminated string');

  emit(state, decode ? JSON.stringify(value) : input.slice(start, index + 1));
  state.index = index + 1;
}

function normalizeNumber(state: ScanState, token: string): string {
  const sign = token.startsWith('-') ? '-' : '';
  const body = token.replace(/^[+-]/, '');

  if (body === 'Infinity' || body === 'NaN')
    fail(state, state.index, `${sign}${body} has no JSON equivalent; use null or a string`);
  if (/^0x/i.test(body)) return sign + BigInt(body).toString();

  return sign + body.replace(/^\./, '0.').replace(/\.(?=[eE]|$)/, '.0');
}

function scanIdentifier(state: ScanState): boolean {
  identifierPattern.lastIndex = state.index;
  const token = identifierPattern.exec(state.input)?.[0];

  if (!token) return false;

  const isKey = nextSignificant(state.input, identifierPattern.lastIndex) === ':';

  if (!isKey && (token === 'Infinity' || token === 'NaN')) return false;
  if (!isKey && !['false', 'null', 'true'].includes(token))
    fail(state, state.index, `Unquoted value "${token}" is not valid JSON5`);

  emit(state, isKey ? JSON.stringify(decodeIdentifier(state, token)) : token);
  state.index += token.length;

  return true;
}

function decodeIdentifier(state: ScanState, token: string): string {
  const decoded = token.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  if (!decodedIdentifier.test(decoded))
    fail(state, state.index, `Key "${token}" is not a valid JSON5 identifier`);

  return decoded;
}

function scanJson5Word(state: ScanState): boolean {
  if (scanIdentifier(state)) return true;

  json5NumberPattern.lastIndex = state.index;
  const token = json5NumberPattern.exec(state.input)?.[0];

  if (!token) return false;

  emit(state, normalizeNumber(state, token));
  state.index = json5NumberPattern.lastIndex;

  return true;
}

function scanToken(state: ScanState): void {
  const { index, input } = state;
  const char = input.charAt(index);
  const next = input.charAt(index + 1);

  if (char === '/' && (next === '/' || next === '*')) return scanComment(state);
  if (char === '"' || char === "'") return scanString(state);
  if (char === '}' || char === ']') closeContainer(state);
  if (state.dialect === 'json5' && !/[{}[\],:\s]/.test(char) && scanJson5Word(state)) return;

  emit(state, state.dialect === 'json5' && json5WhiteSpace.test(char) ? ' ' : char);
  state.index = index + 1;
}

export function jsoncToJson(input: string, options: JsoncToJsonOptions): JsoncToJsonResult {
  requiredText(input, options.dialect === 'json5' ? 'JSON5' : 'JSONC');
  if (input.length > maxLength)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 5,000,000 characters.');

  const state: ScanState = {
    beforeComma: '',
    comments: 0,
    dialect: options.dialect,
    index: 0,
    input,
    lastComma: -1,
    lastSignificant: '',
    out: [],
    starts: [],
  };

  while (state.index < input.length) {
    state.starts.push(state.index);
    scanToken(state);
  }

  const { report, text } = formatJson(state, options);

  return { comments: state.comments, duplicateKeys: report.duplicateKeys, text };
}
