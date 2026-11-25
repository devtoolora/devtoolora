import { FunctionError } from '../errors';
import {
  checkJsonLength,
  formatJsonTokens,
  isOutOfDoubleRange,
  type JsonDocumentNode,
  type JsonDocumentOptions,
  type JsonDocumentReport,
  type JsonDocumentResult,
  type JsonDuplicateKeys,
} from './jsonDocumentHelpers';

export type {
  JsonDocumentNode,
  JsonDocumentOptions,
  JsonDocumentReport,
  JsonDocumentResult,
  JsonDuplicateKeys,
};

export class JsonNumberToken {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  toString(): string {
    return this.text;
  }
}

export type LosslessJsonValue =
  null | boolean | string | JsonNumberToken | LosslessJsonValue[] | Map<string, LosslessJsonValue>;

export interface LosslessJsonLimits {
  depth?: number;
  values?: number;
}

interface LosslessCollector {
  allowDuplicates?: boolean;
  duplicates?: JsonDuplicateKeys;
  limits: LosslessJsonLimits;
  value: LosslessJsonValue;
}

const numberPattern = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

export function processJsonDocument(
  source: string,
  options: JsonDocumentOptions = {},
): JsonDocumentResult {
  return parseJsonDocument(source, options);
}

export function parseLosslessJson(
  source: string,
  limits: LosslessJsonLimits = {},
): LosslessJsonValue {
  const collector: LosslessCollector = { limits, value: null };

  parseJsonDocument(source, { mode: 'validate' }, collector);

  return collector.value;
}

export function parseLosslessJsonData(
  source: string,
  limits: LosslessJsonLimits = {},
): { duplicates: JsonDuplicateKeys | undefined; value: LosslessJsonValue } {
  const collector: LosslessCollector = { allowDuplicates: true, limits, value: null };

  parseJsonDocument(source, { mode: 'validate' }, collector);

  return { duplicates: collector.duplicates, value: collector.value };
}

function jsonValueLimit(options: JsonDocumentOptions, lossless?: LosslessCollector): number {
  if (lossless) return lossless.limits.values ?? Number.POSITIVE_INFINITY;

  return options.limits?.values ?? (options.collectTree ? 5_000 : 100_000);
}

type JsonValueType = JsonDocumentNode['type'];

interface JsonParseState {
  bom: number;
  depthLimit: number;
  lossless?: LosslessCollector;
  nodes: JsonDocumentNode[];
  offset: number;
  options: JsonDocumentOptions;
  parsed: LosslessJsonValue;
  report: JsonDocumentReport;
  source: string;
  tokens: string[];
  treeCharacters: number;
  valueLimit: number;
}

/** A strict-JSON syntax error; callers that rewrote the source map `offset` back to their input. */
export class JsonSyntaxError extends FunctionError {
  constructor(
    readonly offset: number,
    readonly reason: string,
    location: string,
  ) {
    super('INVALID_JSON', `Invalid JSON at ${location}: ${reason}`);
  }
}

function failJson(state: JsonParseState, message: string, position = state.offset): never {
  throw new JsonSyntaxError(position, message, jsonLocation(state, position));
}

function jsonLines(state: JsonParseState, position: number): string[] {
  return state.source.slice(0, position).split(/\r\n|\r|\n/);
}

function jsonLocation(state: JsonParseState, position: number): string {
  const lines = jsonLines(state, position);
  const column = (lines.at(-1) ?? '').length + 1 - (lines.length === 1 ? state.bom : 0);

  return `line ${lines.length}, column ${column} (offset ${position})`;
}

function skipJsonWhitespace(state: JsonParseState): void {
  while (state.offset < state.source.length && /[ \t\r\n]/.test(state.source.charAt(state.offset)))
    state.offset += 1;
}

function addJsonWarning(state: JsonParseState, message: string): void {
  if (state.report.warnings.length < 20) state.report.warnings.push(message);
}

function expectJsonSymbol(state: JsonParseState, expected: string): void {
  skipJsonWhitespace(state);
  if (state.source[state.offset] !== expected)
    failJson(state, `Expected ${JSON.stringify(expected)}.`);
  if (!state.lossless) state.tokens.push(expected);

  state.offset += 1;
}

function readJsonStringToken(state: JsonParseState): string {
  const { source } = state;
  const start = state.offset;

  state.offset += 1;

  while (state.offset < source.length) {
    const character = source.charAt(state.offset);

    if (character === '"') {
      state.offset += 1;
      const raw = source.slice(start, state.offset);

      if (!state.lossless) state.tokens.push(raw);

      return raw;
    }

    if (character.charCodeAt(0) < 32) failJson(state, 'Unescaped control character in string.');

    if (character === '\\') {
      state.offset += 1;
      const escaped = source[state.offset];

      if (escaped === 'u') {
        if (!/^[0-9a-fA-F]{4}$/.test(source.slice(state.offset + 1, state.offset + 5)))
          failJson(state, 'Expected four hexadecimal digits after \\u.');

        state.offset += 4;
      } else if (escaped === undefined || !'"\\/bfnrt'.includes(escaped)) {
        failJson(state, 'Invalid string escape.');
      }
    }

    state.offset += 1;
  }

  failJson(state, 'Unterminated string.', start);
}

function startJsonNode(
  state: JsonParseState,
  depth: number,
  label: string,
  pointer: string,
  parentId: number | null,
): JsonDocumentNode {
  skipJsonWhitespace(state);
  state.report.values += 1;
  if (state.report.values > state.valueLimit)
    throw new FunctionError(
      'JSON_LIMIT',
      `JSON is limited to ${state.valueLimit.toLocaleString('en-US')} values${state.options.collectTree ? ' in Tree mode' : ''}.`,
    );

  const start = state.offset;
  const node: JsonDocumentNode = {
    childCount: 0,
    depth,
    end: start,
    id: state.nodes.length,
    label,
    parentId,
    pointer,
    start,
    token: '',
    type: 'null',
  };

  if (state.options.collectTree) {
    state.treeCharacters += pointer.length + label.length;
    if (state.treeCharacters > 8_000_000)
      throw new FunctionError(
        'JSON_LIMIT',
        'JSON Tree paths are limited to 8,000,000 total characters.',
      );

    state.nodes.push(node);
  }

  return node;
}

function parseJsonValue(
  state: JsonParseState,
  depth: number,
  label = '$',
  pointer = '',
  parentId: number | null = null,
): JsonValueType {
  const node = startJsonNode(state, depth, label, pointer, parentId);
  const character = state.source[state.offset];

  if (character === '{' || character === '[') return parseJsonContainer(state, node, character);

  if (character === '"') {
    node.token = readJsonStringToken(state);
    if (state.lossless) state.parsed = JSON.parse(node.token);

    node.type = 'string';
    node.end = state.offset;

    return node.type;
  }

  const scalarType = parseJsonLiteral(state, node) ?? parseJsonNumber(state, node);

  if (scalarType) return scalarType;

  failJson(state, 'Expected an object, array, string, number, true, false or null.');
}

function parseJsonLiteral(
  state: JsonParseState,
  node: JsonDocumentNode,
): JsonValueType | undefined {
  for (const literal of ['true', 'false', 'null']) {
    if (state.source.startsWith(literal, state.offset)) {
      if (!state.lossless) state.tokens.push(literal);
      if (state.lossless) state.parsed = literal === 'null' ? null : literal === 'true';

      state.offset += literal.length;
      node.token = literal;
      node.type = literal === 'null' ? 'null' : 'boolean';
      node.end = state.offset;

      return node.type;
    }
  }

  return undefined;
}

function parseJsonNumber(state: JsonParseState, node: JsonDocumentNode): JsonValueType | undefined {
  numberPattern.lastIndex = state.offset;
  const number = numberPattern.exec(state.source)?.[0];

  if (number === undefined) return undefined;

  if (isOutOfDoubleRange(number) || Math.abs(Number(number)) > Number.MAX_SAFE_INTEGER) {
    state.report.numbersOutsideSafeRange += 1;

    addJsonWarning(
      state,
      `Number ${number.length > 60 ? `${number.slice(0, 60)}…` : number} at offset ${state.offset} may lose range or precision in JavaScript; its original token is preserved.`,
    );
  }

  if (state.lossless) state.parsed = new JsonNumberToken(number);
  else state.tokens.push(number);

  node.token = state.source.slice(node.start, node.start + number.length);
  node.type = 'number';
  state.offset += number.length;
  node.end = state.offset;

  return 'number';
}

function parseJsonContainer(
  state: JsonParseState,
  node: JsonDocumentNode,
  opening: string,
): JsonValueType {
  const nextDepth = node.depth + 1;

  if (nextDepth > state.depthLimit)
    throw new FunctionError(
      'JSON_LIMIT',
      `JSON is limited to ${state.depthLimit.toLocaleString('en-US')} nested containers.`,
    );

  state.report.maxDepth = Math.max(state.report.maxDepth, nextDepth);
  const isObject = opening === '{';

  if (isObject) state.report.objects += 1;
  else state.report.arrays += 1;

  const closing = isObject ? '}' : ']';

  expectJsonSymbol(state, opening);
  skipJsonWhitespace(state);
  const emptyContainer = (): LosslessJsonValue[] | Map<string, LosslessJsonValue> =>
    isObject ? new Map() : [];
  const container = state.lossless ? emptyContainer() : undefined;

  if (state.source[state.offset] !== closing)
    parseJsonMembers(state, node, isObject, closing, container);

  expectJsonSymbol(state, closing);
  if (container) state.parsed = container;

  node.type = isObject ? 'object' : 'array';
  node.token = isObject ? '{}' : '[]';
  node.end = state.offset;

  return node.type;
}

function parseJsonMembers(
  state: JsonParseState,
  node: JsonDocumentNode,
  isObject: boolean,
  closing: string,
  container: LosslessJsonValue[] | Map<string, LosslessJsonValue> | undefined,
): void {
  const keys = new Set<string>();

  while (true) {
    let childLabel = `[${node.childCount}]`;
    let childKey = String(node.childCount);
    let key = '';

    if (isObject) {
      key = parseJsonObjectKey(state, keys);
      childLabel = JSON.stringify(key);
      childKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
    }

    parseJsonValue(
      state,
      node.depth + 1,
      childLabel,
      state.options.collectTree ? `${node.pointer}/${childKey}` : '',
      node.id,
    );

    if (container instanceof Map) container.set(key, state.parsed);
    else container?.push(state.parsed);

    node.childCount += 1;
    skipJsonWhitespace(state);
    if (state.source[state.offset] !== ',') break;

    expectJsonSymbol(state, ',');
    skipJsonWhitespace(state);
    if (state.source[state.offset] === closing)
      failJson(state, 'Trailing commas are not valid JSON.');
  }
}

function parseJsonObjectKey(state: JsonParseState, keys: Set<string>): string {
  skipJsonWhitespace(state);
  if (state.source[state.offset] !== '"')
    failJson(state, 'Object keys must be double-quoted strings.');

  const keyOffset = state.offset;
  const key: string = JSON.parse(readJsonStringToken(state));

  if (keys.has(key)) {
    if (state.lossless?.allowDuplicates) noteDuplicateKey(state.lossless, state, key, keyOffset);
    else if (state.lossless)
      throw new FunctionError(
        'DUPLICATE_JSON_KEY',
        `Duplicate key ${JSON.stringify(key)} at ${jsonLocation(state, keyOffset)}. Remove or rename one occurrence; only one value per key can be kept.`,
      );

    state.report.duplicateKeys += 1;

    addJsonWarning(
      state,
      `Duplicate key ${JSON.stringify(key)} at offset ${keyOffset}; preserved, but consumers may keep only its last value.`,
    );
  }

  keys.add(key);
  expectJsonSymbol(state, ':');

  return key;
}

function noteDuplicateKey(
  lossless: LosslessCollector,
  state: JsonParseState,
  key: string,
  keyOffset: number,
): void {
  const first = lossless.duplicates;

  lossless.duplicates = first
    ? { ...first, count: first.count + 1 }
    : { count: 1, key, line: jsonLines(state, keyOffset).length };
}

function parseJsonDocument(
  source: string,
  options: JsonDocumentOptions,
  lossless?: LosslessCollector,
): JsonDocumentResult {
  const mode = options.mode ?? 'format';
  const indentation = options.indentation ?? '2';
  const lineEnding = options.lineEnding ?? 'lf';

  if (
    !['format', 'minify', 'validate'].includes(mode) ||
    !['2', '4', 'tab'].includes(indentation) ||
    !['lf', 'crlf'].includes(lineEnding)
  ) {
    throw new FunctionError(
      'INVALID_JSON_OPTIONS',
      'Choose a supported JSON mode, indentation and line ending.',
    );
  }

  if (!lossless) checkJsonLength(source, options);

  // A single leading byte order mark is ignored, as editors and CSV import do; offsets still count
  // it.
  const bom = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const state: JsonParseState = {
    bom,
    depthLimit: lossless?.limits.depth ?? 128,
    lossless,
    nodes: [],
    offset: bom,
    options,
    parsed: null,
    report: {
      arrays: 0,
      duplicateKeys: 0,
      maxDepth: 0,
      numbersOutsideSafeRange: 0,
      objects: 0,
      rootType: '',
      valid: true,
      values: 0,
      warnings: [],
    },
    source,
    tokens: [],
    treeCharacters: 0,
    valueLimit: jsonValueLimit(options, lossless),
  };
  const { nodes, report, tokens } = state;

  skipJsonWhitespace(state);
  if (state.offset === source.length)
    throw new FunctionError('REQUIRED_JSON', 'JSON input is required.');

  report.rootType = parseJsonValue(state, 0);
  skipJsonWhitespace(state);
  if (state.offset !== source.length) failJson(state, 'Unexpected content after the JSON value.');
  if (lossless) lossless.value = state.parsed;
  if (mode === 'validate') return { nodes, report, text: JSON.stringify(report, null, 2) };
  if (mode === 'minify') return { nodes, report, text: tokens.join('') };

  const indent = indentation === 'tab' ? '\t' : ' '.repeat(Number(indentation));
  const newline = lineEnding === 'crlf' ? '\r\n' : '\n';

  return { nodes, report, text: formatJsonTokens(tokens, indent, newline) };
}
