import { FunctionError } from '../errors';
import { canonicalNumber, compareJsonDocuments, type JsonDiffChange } from './jsonDiff';
import {
  JsonNumberToken,
  parseLosslessJson,
  parseLosslessJsonData,
  processJsonDocument,
  type LosslessJsonValue,
} from './jsonDocument';
import { keepLastDuplicateValues, stringifyLosslessJson } from './json';

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: string;
}

export interface JsonPatchResult {
  operations: JsonPatchOperation[];
  text: string;
}

type JsonContainer = LosslessJsonValue[] | Map<string, LosslessJsonValue>;
type PatchEntry = Map<string, LosslessJsonValue>;

interface PatchState {
  copied: number;
  document: LosslessJsonValue;
}

const patchOps = { added: 'add', changed: 'replace', removed: 'remove' } as const;
const arrayIndexPattern = /^(?:0|[1-9][0-9]*)$/;

class OperationFailure extends Error {}

function fail(reason: string): never {
  throw new OperationFailure(reason);
}

function parentPointer(pointer: string): string {
  return pointer.slice(0, pointer.lastIndexOf('/'));
}

// The diff lists array removals by ascending index; each run is reversed so the indexes still
// point at the right elements while the patch applies in order.
function orderRemovals(changes: JsonDiffChange[]): JsonDiffChange[] {
  const ordered: JsonDiffChange[] = [];
  let run: JsonDiffChange[] = [];

  for (const change of changes) {
    const [first] = run;

    if (
      first &&
      (change.kind !== 'removed' || parentPointer(change.pointer) !== parentPointer(first.pointer))
    ) {
      for (const removal of run.reverse()) ordered.push(removal);

      run = [];
    }

    if (change.kind === 'removed') run.push(change);
    else ordered.push(change);
  }

  for (const removal of run.reverse()) ordered.push(removal);

  return ordered;
}

export function generateJsonPatch(original: string, target: string): JsonPatchResult {
  const { changes } = compareJsonDocuments(
    keepLastDuplicateValues(original),
    keepLastDuplicateValues(target),
    'value',
    { characters: 5_000_000, values: 100_000 },
    ['Original', 'Target'],
  );
  const operations: JsonPatchOperation[] = orderRemovals(changes).map(
    ({ after, kind, pointer }) => ({
      op: patchOps[kind],
      path: pointer,
      ...(after === undefined ? {} : { value: after }),
    }),
  );
  const lines = operations.map(
    ({ op, path, value }) =>
      `  {"op":"${op}","path":${JSON.stringify(path)}${value === undefined ? '' : `,"value":${value}`}}`,
  );

  return { operations, text: lines.length === 0 ? '[]' : `[\n${lines.join(',\n')}\n]` };
}

function parseSource(
  source: string,
  name: string,
  read: typeof parseLosslessJson = parseLosslessJson,
): LosslessJsonValue {
  if (source.length > 5_000_000)
    throw new FunctionError('JSON_PATCH_LIMIT', `${name} is limited to 5,000,000 characters.`);

  try {
    return read(source, { depth: 128, values: 2_500_000 });
  } catch (error) {
    if (error instanceof FunctionError)
      throw new FunctionError(error.code, `${name}: ${error.message}`);

    throw error;
  }
}

function pointerTokens(pointer: string, name: 'from' | 'path'): string[] {
  if (/~(?![01])/.test(pointer)) fail(`${name} has ~ not followed by 0 or 1`);

  return pointer
    .split('/')
    .slice(1)
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function childValue(value: LosslessJsonValue, token: string): LosslessJsonValue | undefined {
  if (value instanceof Map) return value.get(token);
  if (Array.isArray(value) && arrayIndexPattern.test(token)) return value[Number(token)];

  return undefined;
}

function valueAt(document: LosslessJsonValue, tokens: string[]): LosslessJsonValue | undefined {
  let current: LosslessJsonValue | undefined = document;

  for (const token of tokens) if (current !== undefined) current = childValue(current, token);

  return current;
}

function parentAt(
  document: LosslessJsonValue,
  tokens: string[],
): { key: string; parent: JsonContainer } {
  const parent = valueAt(document, tokens.slice(0, -1));

  if (!(parent instanceof Map) && !Array.isArray(parent)) fail('parent does not exist');

  return { key: tokens.at(-1) ?? '', parent };
}

function arrayIndex(array: LosslessJsonValue[], token: string, inserting: boolean): number {
  const last = inserting ? array.length : array.length - 1;

  if (inserting && token === '-') return array.length;
  if (!arrayIndexPattern.test(token)) fail(`array index ${token} is not a valid index`);
  if (Number(token) <= last) return Number(token);
  if (last < 0) fail('path does not exist');

  return fail(`array index ${token} is out of range 0-${last}`);
}

function measureValue(value: LosslessJsonValue, depth: number): number {
  if (!(value instanceof Map) && !Array.isArray(value)) return stringifyLosslessJson(value).length;
  if (depth >= 128) fail('the result is limited to 128 nesting levels');

  let size = 2;

  if (value instanceof Map)
    for (const [key, entry] of value) size += key.length + 4 + measureValue(entry, depth + 1);
  else for (const entry of value) size += 1 + measureValue(entry, depth + 1);

  return size;
}

function cloneValue(value: LosslessJsonValue): LosslessJsonValue {
  if (value instanceof Map)
    return new Map(
      [...value].map(([key, entry]): [string, LosslessJsonValue] => [key, cloneValue(entry)]),
    );
  if (Array.isArray(value)) return value.map(cloneValue);

  return value;
}

// Numbers compare by value and objects without key order, as RFC 6902 `test` requires.
function sameValue(left: LosslessJsonValue, right: LosslessJsonValue): boolean {
  if (left instanceof JsonNumberToken || right instanceof JsonNumberToken)
    return (
      left instanceof JsonNumberToken &&
      right instanceof JsonNumberToken &&
      canonicalNumber(left.text) === canonicalNumber(right.text)
    );
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => sameMember(entry, right[index]))
    );
  if (left instanceof Map || right instanceof Map)
    return (
      left instanceof Map &&
      right instanceof Map &&
      left.size === right.size &&
      [...left].every(([key, entry]) => sameMember(entry, right.get(key)))
    );

  return left === right;
}

function sameMember(left: LosslessJsonValue, right: LosslessJsonValue | undefined): boolean {
  return right !== undefined && sameValue(left, right);
}

function memberValue(entry: PatchEntry): LosslessJsonValue {
  if (!entry.has('value')) fail('value is missing');

  return entry.get('value') ?? null;
}

function fromPointer(entry: PatchEntry): string {
  const from = entry.get('from');

  if (typeof from !== 'string') fail('from must be a string');
  if (from !== '' && !from.startsWith('/')) fail('from must be empty or start with /');

  return from;
}

function existingValue(state: PatchState, tokens: string[], name: 'from' | 'path') {
  const value = valueAt(state.document, tokens);

  if (value === undefined) fail(`${name} does not exist`);

  return value;
}

function insertValue(state: PatchState, tokens: string[], value: LosslessJsonValue): void {
  if (tokens.length === 0) {
    state.document = value;

    return;
  }

  const { key, parent } = parentAt(state.document, tokens);

  if (parent instanceof Map) parent.set(key, value);
  else parent.splice(arrayIndex(parent, key, true), 0, value);
}

function removeValue(state: PatchState, tokens: string[]): LosslessJsonValue {
  if (tokens.length === 0) fail('the whole document cannot be removed');

  const { key, parent } = parentAt(state.document, tokens);

  if (!(parent instanceof Map)) return parent.splice(arrayIndex(parent, key, false), 1)[0] ?? null;

  const value = parent.get(key);

  if (value === undefined) fail('path does not exist');

  parent.delete(key);

  return value;
}

function replaceValue(state: PatchState, tokens: string[], value: LosslessJsonValue): void {
  if (tokens.length === 0) {
    state.document = value;

    return;
  }

  const { key, parent } = parentAt(state.document, tokens);

  if (!(parent instanceof Map)) parent[arrayIndex(parent, key, false)] = value;
  else if (parent.has(key)) parent.set(key, value);
  else fail('path does not exist');
}

function moveValue(state: PatchState, path: string, entry: PatchEntry): void {
  const from = fromPointer(entry);
  const fromTokens = pointerTokens(from, 'from');
  const pathTokens = pointerTokens(path, 'path');

  if (path.startsWith(`${from}/`)) fail('from cannot be a parent of path');

  const value = existingValue(state, fromTokens, 'from');

  if (from === path) return;
  if (pathTokens.length > fromTokens.length) measureValue(value, pathTokens.length);

  removeValue(state, fromTokens);
  insertValue(state, pathTokens, value);
}

function copyValue(state: PatchState, path: string, entry: PatchEntry): void {
  const value = existingValue(state, pointerTokens(fromPointer(entry), 'from'), 'from');
  const pathTokens = pointerTokens(path, 'path');

  state.copied += measureValue(value, pathTokens.length);
  if (state.copied > 5_000_000) fail('copied values are limited to 5,000,000 characters in total');

  insertValue(state, pathTokens, cloneValue(value));
}

const operationHandlers = new Map<
  string,
  (state: PatchState, path: string, entry: PatchEntry) => void
>([
  [
    'add',
    (state, path, entry) => {
      const tokens = pointerTokens(path, 'path');
      const value = memberValue(entry);

      measureValue(value, tokens.length);
      insertValue(state, tokens, value);
    },
  ],
  ['remove', (state, path) => void removeValue(state, pointerTokens(path, 'path'))],
  [
    'replace',
    (state, path, entry) => {
      const tokens = pointerTokens(path, 'path');
      const value = memberValue(entry);

      measureValue(value, tokens.length);
      replaceValue(state, tokens, value);
    },
  ],
  ['move', moveValue],
  ['copy', copyValue],
  [
    'test',
    (state, path, entry) => {
      const expected = memberValue(entry);

      if (!sameValue(existingValue(state, pointerTokens(path, 'path'), 'path'), expected))
        fail('value differs');
    },
  ],
]);

function invalidOperation(number: number, reason: string): FunctionError {
  return new FunctionError('INVALID_JSON_PATCH', `Operation ${number}: ${reason}.`);
}

function applyOperation(state: PatchState, entry: LosslessJsonValue, number: number): void {
  if (!(entry instanceof Map)) throw invalidOperation(number, 'an operation must be an object');

  const op = entry.get('op');
  const path = entry.get('path');
  const handler = typeof op === 'string' ? operationHandlers.get(op) : undefined;

  if (!handler)
    throw invalidOperation(number, 'op must be add, remove, replace, move, copy or test');
  if (typeof path !== 'string') throw invalidOperation(number, 'path must be a string');
  if (path !== '' && !path.startsWith('/'))
    throw invalidOperation(number, 'path must be empty or start with /');

  try {
    handler(state, path, entry);
  } catch (error) {
    if (error instanceof OperationFailure)
      throw new FunctionError(
        'JSON_PATCH_FAILED',
        `Operation ${number} (${String(op)} ${path}): ${error.message}.`,
      );

    throw error;
  }
}

export function applyJsonPatch(document: string, patch: string): { applied: number; text: string } {
  const state: PatchState = {
    copied: 0,
    document: parseSource(
      document,
      'Document JSON',
      (source, limits) => parseLosslessJsonData(source, limits).value,
    ),
  };
  const operations = parseSource(patch, 'JSON Patch');

  if (!Array.isArray(operations))
    throw new FunctionError('INVALID_JSON_PATCH', 'A JSON Patch must be an array of operations.');
  if (operations.length > 10_000)
    throw new FunctionError('JSON_PATCH_LIMIT', 'A JSON Patch is limited to 10,000 operations.');

  operations.forEach((entry, index) => applyOperation(state, entry, index + 1));

  const text = processJsonDocument(stringifyLosslessJson(state.document), {
    indentation: '2',
    limits: { characters: Number.POSITIVE_INFINITY, values: 2_500_000 },
    mode: 'format',
  }).text;

  return { applied: operations.length, text };
}
