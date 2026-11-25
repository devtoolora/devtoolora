import { FunctionError } from '../errors';
import type { JsonValue } from './json';
import { JsonNumberToken, parseLosslessJsonData, type LosslessJsonValue } from './jsonDocument';
import { requiredText } from './shared';
import { yamlToJson } from './yaml';

const maxCharacters = 5_000_000;
const maxLines = 100_000;
const maxNesting = 100;
const separators = new Set(['=', ':']);
const whitespace = new Set([' ', '\t', '\f']);
const simpleEscapes: Record<string, string> = { f: '\f', n: '\n', r: '\r', t: '\t' };

type PropertiesObject = { [key: string]: JsonValue };

function failAt(line: number, message: string): never {
  throw new FunctionError('INVALID_PROPERTIES', `${message} at line ${line}.`);
}

function checkCharacters(source: string, label: string): void {
  if (source.length > maxCharacters)
    throw new FunctionError(
      'PROPERTIES_LIMIT',
      `${label} input is limited to 5,000,000 characters.`,
    );
}

function checkLineCount(count: number, label: string): void {
  if (count > maxLines)
    throw new FunctionError('PROPERTIES_LIMIT', `${label} is limited to 100,000 lines.`);
}

// defineProperty keeps a key such as "__proto__" as plain data.
function setEntry(target: PropertiesObject, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function endsWithOddBackslashes(text: string): boolean {
  let trailing = 0;

  while (text[text.length - 1 - trailing] === '\\') trailing += 1;

  return trailing % 2 === 1;
}

// Joins natural lines into logical ones as java.util.Properties does; comment lines never continue.
function logicalLines(source: string): Array<{ line: number; text: string }> {
  const lines = source.split(/\r\n|\r|\n/);

  if (lines.at(-1) === '') lines.pop();

  checkLineCount(lines.length, 'Properties input');

  const logical: Array<{ line: number; text: string }> = [];
  let current: { line: number; text: string } | undefined;

  lines.forEach((raw, index) => {
    const text = raw.replace(/^[ \t\f]+/, '');

    if (!current && (!text || text.startsWith('#') || text.startsWith('!'))) return;

    const continues = endsWithOddBackslashes(text);
    const body = continues ? text.slice(0, -1) : text;

    if (current) current.text += body;
    else current = { line: index + 1, text: body };

    if (!continues) {
      logical.push(current);
      current = undefined;
    }
  });

  if (current) logical.push(current);

  return logical;
}

function unescape(text: string, line: number): string {
  return text.replace(/\\(u[\s\S]{0,4}|[\s\S])/g, (_, escape: string) => {
    if (!escape.startsWith('u')) return simpleEscapes[escape] ?? escape;
    if (!/^u[0-9a-fA-F]{4}$/.test(escape)) failAt(line, 'Malformed \\uXXXX escape');

    return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
  });
}

function splitEntry(text: string): [key: string, value: string] {
  let keyEnd = 0;

  while (keyEnd < text.length) {
    const char = text[keyEnd] ?? '';

    if (separators.has(char) || whitespace.has(char)) break;

    keyEnd += char === '\\' ? 2 : 1;
  }

  let valueStart = Math.min(keyEnd, text.length);
  let hasSeparator = false;

  while (valueStart < text.length) {
    const char = text[valueStart] ?? '';

    if (separators.has(char) && !hasSeparator) hasSeparator = true;
    else if (!whitespace.has(char)) break;

    valueStart += 1;
  }

  return [text.slice(0, Math.min(keyEnd, text.length)), text.slice(valueStart)];
}

export function parseProperties(input: string): Array<[key: string, value: string]> {
  checkCharacters(input, 'Properties');

  const source = input.replace(/^\uFEFF/, '');

  requiredText(source, 'Properties');

  return logicalLines(source).map(({ line, text }) => {
    const [key, value] = splitEntry(text);

    return [unescape(key, line), unescape(value, line)];
  });
}

function nestEntry(root: PropertiesObject, key: string, value: string): void {
  const names = key.split('.');

  if (names.length > maxNesting)
    throw new FunctionError('PROPERTIES_LIMIT', 'Nested keys are limited to 100 levels.');

  const last = names.pop() ?? '';
  let target = root;

  names.forEach((name, index) => {
    const existing = Object.hasOwn(target, name) ? target[name] : undefined;

    if (typeof existing === 'string') throw conflict(names.slice(0, index + 1).join('.'));

    if (existing === undefined) {
      const created: PropertiesObject = {};

      setEntry(target, name, created);
      target = created;
    } else target = existing as PropertiesObject;
  });

  if (Object.hasOwn(target, last) && typeof target[last] === 'object') throw conflict(key);

  setEntry(target, last, value);
}

function conflict(key: string): FunctionError {
  return new FunctionError(
    'PROPERTIES_CONFLICT',
    `Key ${JSON.stringify(key)} is both a value and a parent of other keys; turn off Nested keys to keep both.`,
  );
}

export function propertiesToJson(input: string, options: { nested: boolean }): JsonValue {
  // The last duplicate wins, as in java.util.Properties.
  const entries = new Map(parseProperties(input));
  const root: PropertiesObject = {};

  for (const [key, value] of entries) {
    if (options.nested) nestEntry(root, key, value);
    else setEntry(root, key, value);
  }

  return root;
}

type WritableValue = JsonValue | LosslessJsonValue;

const writeEscapes: Record<string, string> = {
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '!': '\\!',
  '#': '\\#',
  ':': '\\:',
  '=': '\\=',
  '\\': '\\\\',
};

function unicodeEscape(char: string): string {
  return `\\u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

// Spaces are escaped everywhere in keys and only at the start of values, as Properties.store does.
function escapeText(text: string, options: { asciiOnly: boolean; key: boolean }): string {
  const pattern = options.asciiOnly
    ? /[\t\n\f\r !#:=\\]|[^\u0020-\u007e]/g
    : /[\t\n\f\r !#:=\\]|[\u0000-\u001f\u007f]/g;

  return text.replace(pattern, (char: string, offset: number) => {
    if (char === ' ') return options.key || offset === 0 ? '\\ ' : ' ';

    return writeEscapes[char] ?? unicodeEscape(char);
  });
}

function entriesOf(value: WritableValue): Array<[string, WritableValue]> | undefined {
  if (value instanceof Map) return [...value];
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value instanceof JsonNumberToken
  )
    return undefined;

  return Object.entries(value);
}

function scalarText(key: string, value: WritableValue): string {
  if (value === null)
    throw new FunctionError(
      'PROPERTIES_NULL',
      `Key ${JSON.stringify(key)} is null, which .properties cannot represent.`,
    );
  if (Array.isArray(value))
    throw new FunctionError(
      'PROPERTIES_ARRAY',
      `Key ${JSON.stringify(key)} holds an array, which .properties cannot represent.`,
    );
  if (value instanceof JsonNumberToken) return value.text;

  return typeof value === 'string' ? value : JSON.stringify(value);
}

interface WriteState {
  asciiOnly: boolean;
  keys: Set<string>;
  lines: string[];
}

function collectLines(value: WritableValue, prefix: string | undefined, state: WriteState): void {
  for (const [name, entry] of entriesOf(value) ?? []) {
    const key = prefix === undefined ? name : `${prefix}.${name}`;

    if (entriesOf(entry)) {
      collectLines(entry, key, state);

      continue;
    }

    if (state.keys.has(key))
      throw new FunctionError(
        'PROPERTIES_DUPLICATE',
        `Key ${JSON.stringify(key)} would be written twice after flattening nested objects.`,
      );

    state.keys.add(key);

    state.lines.push(
      `${escapeText(key, { asciiOnly: state.asciiOnly, key: true })}=${escapeText(scalarText(key, entry), { asciiOnly: state.asciiOnly, key: false })}`,
    );

    checkLineCount(state.lines.length, 'Properties output');
  }
}

export function jsonToProperties(value: WritableValue, options: { asciiOnly: boolean }): string {
  if (!entriesOf(value))
    throw new FunctionError('PROPERTIES_ROOT', 'Conversion to .properties requires a root object.');

  const state: WriteState = { asciiOnly: options.asciiOnly, keys: new Set(), lines: [] };

  collectLines(value, undefined, state);

  return state.lines.length ? `${state.lines.join('\n')}\n` : '# Empty object\n';
}

export function jsonDocumentToProperties(source: string, options: { asciiOnly: boolean }): string {
  checkCharacters(source, 'JSON');
  requiredText(source, 'JSON');

  return jsonToProperties(parseLosslessJsonData(source).value, options);
}

export function yamlDocumentToProperties(source: string, options: { asciiOnly: boolean }): string {
  checkCharacters(source, 'YAML');
  requiredText(source, 'YAML');

  return jsonToProperties(yamlToJson(source), options);
}
