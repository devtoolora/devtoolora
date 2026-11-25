import { FunctionError } from '../errors';
import {
  parseLosslessJson,
  parseLosslessJsonData,
  rejectOutOfRangeNumbers,
  type JsonValue,
} from '../format';
import { JsonSyntaxError } from '../format/jsonDocument';

export type JsonSchemaDraft = '2020-12' | '2019-09' | 'draft-07';

export const jsonSchemaDraftUris: Readonly<Record<JsonSchemaDraft, string>> = {
  '2019-09': 'https://json-schema.org/draft/2019-09/schema',
  '2020-12': 'https://json-schema.org/draft/2020-12/schema',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
};

export const jsonSchemaLimits: Readonly<{
  dataCharacters: number;
  dataNodes: number;
  depth: number;
  reportedErrors: number;
  schemaCharacters: number;
  schemaNodes: number;
}> = {
  dataCharacters: 1_000_000,
  dataNodes: 50_000,
  depth: 64,
  reportedErrors: 200,
  schemaCharacters: 250_000,
  schemaNodes: 5_000,
};

export function draftFromUri(uri: string): JsonSchemaDraft {
  const normalized = uri.replace(/^https?:/, 'https:').replace(/#$/, '');

  for (const draft of Object.keys(jsonSchemaDraftUris)) {
    const candidate = checkedDraft(draft);

    if (jsonSchemaDraftUris[candidate].replace(/^http:/, 'https:').replace(/#$/, '') === normalized)
      return candidate;
  }

  throw schemaError(
    'Unsupported JSON Schema draft. Use draft-07, 2019-09 or 2020-12; custom meta-schemas are not loaded.',
  );
}

export function parseBoundedJson(
  text: string,
  label: string,
  characters: number,
  nodes: number,
  options: { allowDuplicateKeys?: boolean } = {},
): JsonValue {
  if (!text.trim()) throw schemaError(`${label} is required.`);
  if (text.length > characters)
    throw schemaError(`${label} exceeds ${characters.toLocaleString('en-US')} input characters.`);

  checkStrictJson(text, label, options.allowDuplicateKeys ?? false);

  // The strict parser accepts a leading byte order mark, as editors and CSV import do.
  const value = JSON.parse(text.replace(/^\uFEFF/, '')) as JsonValue;

  checkJsonValue(value, label, characters, nodes);

  // checkJsonValue sees Infinity but cannot tell a 0 that was written as 1e-400.
  try {
    rejectOutOfRangeNumbers(text);
  } catch (error: unknown) {
    throw schemaError(`${label}: ${errorMessage(error)}`);
  }

  return value;
}

// JSON.parse keeps only the last value of a duplicate key and reports raw engine positions.
function checkStrictJson(text: string, label: string, allowDuplicateKeys: boolean): void {
  const read = allowDuplicateKeys ? parseLosslessJsonData : parseLosslessJson;

  try {
    read(text, { depth: jsonSchemaLimits.depth + 1 });
  } catch (error: unknown) {
    if (error instanceof JsonSyntaxError)
      throw schemaError(error.message.replace('Invalid JSON', `Invalid ${label}`));
    if (error instanceof FunctionError && error.code === 'JSON_LIMIT')
      throw schemaError(`${label} exceeds ${jsonSchemaLimits.depth} nesting levels.`);

    throw schemaError(`${label}: ${errorMessage(error)}`);
  }
}

export function checkJsonValue(
  value: JsonValue,
  label: string,
  characters: number,
  nodes: number,
): void {
  const ancestors = new Set<JsonValue>();
  let nodeCount = 0;
  let textCharacters = 0;

  function visit(child: JsonValue, depth: number): void {
    nodeCount += 1;
    if (nodeCount > nodes)
      throw schemaError(`${label} exceeds ${nodes.toLocaleString('en-US')} values/properties.`);
    if (depth > jsonSchemaLimits.depth)
      throw schemaError(`${label} exceeds ${jsonSchemaLimits.depth} nesting levels.`);

    if (
      typeof child === 'number' &&
      (!Number.isFinite(child) || (Number.isInteger(child) && !Number.isSafeInteger(child)))
    ) {
      throw schemaError(
        `${label} contains a non-finite or unsafe integer; quote integers outside ±9007199254740991 to preserve their digits.`,
      );
    }

    if (typeof child === 'string') textCharacters += child.length;
    else if (child !== null && typeof child === 'object') {
      if (ancestors.has(child)) throw schemaError(`${label} contains a circular reference.`);

      ancestors.add(child);

      for (const [key, next] of Object.entries(child)) {
        textCharacters += key.length;
        visit(next, depth + 1);
      }

      ancestors.delete(child);
    }

    if (textCharacters > characters)
      throw schemaError(`${label} exceeds ${characters.toLocaleString('en-US')} characters.`);
  }

  visit(value, 0);
  if (JSON.stringify(value).length > characters)
    throw schemaError(
      `${label} exceeds ${characters.toLocaleString('en-US')} serialized characters.`,
    );
}

export function checkedDraft(draft: string): JsonSchemaDraft {
  if (draft === '2020-12' || draft === '2019-09' || draft === 'draft-07') return draft;

  throw schemaError('Choose draft-07, 2019-09 or 2020-12.');
}

export function checkedBoolean(
  value: boolean | undefined,
  fallback: boolean,
  label: string,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw schemaError(`${label} must be true or false.`);

  return value;
}

export function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function schemaError(message: string): FunctionError {
  return new FunctionError('SCHEMA_ERROR', message);
}
