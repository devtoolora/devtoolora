import { parseAllDocuments, stringify } from 'yaml';
import type { Scalar, ScalarTag, Tags } from 'yaml';
import { FunctionError } from '../errors';
import type { JsonValue } from './json';
import { JsonNumberToken, parseLosslessJsonData } from './jsonDocument';

const maxDepth = 100;
const maxNodes = 1_000_000;

interface ConversionState {
  ancestors: WeakSet<object>;
  nodes: number;
}

const numberTokenTag: ScalarTag = {
  default: true,
  identify: (value: unknown): boolean => value instanceof JsonNumberToken,
  resolve: (text: string): JsonNumberToken => new JsonNumberToken(text),
  stringify: (item: Scalar): string => (item.value as JsonNumberToken).text,
  tag: 'tag:yaml.org,2002:float',
};

export function jsonDocumentToYaml(source: string): string {
  return writeYaml(parseLosslessJsonData(source, { depth: maxDepth, values: maxNodes }).value, [
    numberTokenTag,
  ]);
}

// YAML forbids raw DEL and C1 controls, and YAML 1.1 readers break lines at NEL, LS and PS.
const unsafeYamlCharacters = new RegExp(String.raw`[\x7f-\x9f\u2028\u2029]`, 'g');

function escapeYamlCharacter(character: string): string {
  const code = character.charCodeAt(0);

  return code < 0x100 ? `\\x${code.toString(16)}` : `\\u${code.toString(16)}`;
}

function needsYamlEscapes(node: Scalar): boolean {
  const text = String(node.value);
  const isBlock = node.type === 'BLOCK_LITERAL' || node.type === 'BLOCK_FOLDED';

  unsafeYamlCharacters.lastIndex = 0;

  // A tab is valid YAML, but common readers refuse it inside a plain scalar.
  return unsafeYamlCharacters.test(text) || (!isBlock && text.includes('\t'));
}

export function escapeUnsafeStrings(tags: Tags): Tags {
  return tags.map((tag): Tags[number] => {
    if (typeof tag === 'string' || tag.collection || !tag.tag.endsWith(':str')) return tag;

    const { stringify: stringifyDefault } = tag;

    return {
      ...tag,
      stringify: (node, ...context) =>
        needsYamlEscapes(node)
          ? JSON.stringify(node.value).replace(unsafeYamlCharacters, escapeYamlCharacter)
          : (stringifyDefault?.(node, ...context) ?? ''),
    };
  });
}

// Strings that a YAML 1.1 or 1.2 reader could take for another type are quoted; repeated data is
// written out, not aliased.
function writeYaml(value: unknown, customTags: ScalarTag[] = []): string {
  return stringify(value, {
    aliasDuplicateObjects: false,
    compat: 'yaml-1.1',
    customTags: (tags) => escapeUnsafeStrings([...tags, ...customTags]),
    indent: 2,
    lineWidth: 0,
  });
}

export function jsonToYaml(value: JsonValue, indent = 0): string {
  if (!Number.isInteger(indent) || indent < 0 || indent > maxDepth) {
    throw new FunctionError(
      'INVALID_YAML_INDENT',
      'YAML indentation must be a whole number from 0 to 100.',
    );
  }

  const converted = toJsonValue(value, '$', 0, { ancestors: new WeakSet(), nodes: 0 });
  const output = writeYaml(converted);

  if (indent === 0) return output;

  const pad = '  '.repeat(indent);

  return output.replace(/^(?=.)/gm, pad);
}

export function yamlToJson(text: string): JsonValue {
  try {
    const documents = parseAllDocuments(text, {
      intAsBigInt: true,
      logLevel: 'silent',
      merge: true,
      resolveKnownTags: false,
      stringKeys: true,
      version: '1.2',
    });
    const streamIssue =
      'empty' in documents ? (documents.errors[0] ?? documents.warnings[0]) : undefined;

    if (streamIssue)
      throw new FunctionError(
        'INVALID_YAML',
        `Invalid or unsupported YAML: ${streamIssue.message}`,
      );

    const [document] = documents;

    if (!document) {
      throw new FunctionError('EMPTY_YAML', 'YAML input is empty.');
    }

    if (documents.length !== 1) {
      throw new FunctionError(
        'INVALID_YAML',
        'Convert one YAML document at a time; multiple documents cannot become one JSON value.',
      );
    }

    const issue = document.errors[0] ?? document.warnings[0];

    if (issue)
      throw new FunctionError(
        'INVALID_YAML',
        `Invalid or unsupported YAML: ${issue.message.trimEnd()}`,
      );
    if (document.contents === null) throw new FunctionError('EMPTY_YAML', 'YAML input is empty.');

    if (document.directives?.yaml.version !== '1.2') {
      throw new FunctionError(
        'INVALID_YAML',
        'Use YAML 1.2. A YAML 1.1 directive changes scalar types and is not supported.',
      );
    }

    const parsed: unknown = document.toJS({ mapAsMap: true, maxAliasCount: 100 });

    return toJsonValue(parsed, '$', 0, { ancestors: new WeakSet(), nodes: 0 });
  } catch (error) {
    if (error instanceof FunctionError) throw error;
    if (error instanceof RangeError)
      throw new FunctionError(
        'INVALID_YAML',
        'Could not convert YAML: YAML nesting or alias expansion exceeds the supported limit.',
      );

    const message = error instanceof Error ? error.message : String(error);

    throw new FunctionError('INVALID_YAML', `Could not convert YAML: ${message}`);
  }
}

function toJsonValue(
  value: unknown,
  path: string,
  depth: number,
  state: ConversionState,
): JsonValue {
  state.nodes += 1;

  if (depth > maxDepth || state.nodes > maxNodes) {
    throw incompatible(path, 'The conversion limit is 100 nested levels and 1,000,000 values.');
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'bigint') return bigintToJson(value, path);
  if (typeof value === 'number') return numberToJson(value, path);

  if (typeof value !== 'object')
    throw incompatible(path, 'Only JSON-compatible values can be converted.');
  if (state.ancestors.has(value))
    throw incompatible(path, 'Cyclic aliases cannot be represented in JSON.');

  state.ancestors.add(value);

  try {
    return containerToJson(value, path, depth, state);
  } finally {
    state.ancestors.delete(value);
  }
}

function bigintToJson(value: bigint, path: string): number {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw incompatible(
      path,
      'Quote integers outside ±9,007,199,254,740,991 to preserve their exact digits as strings.',
    );
  }

  return Number(value);
}

function numberToJson(value: number, path: string): number {
  if (!Number.isFinite(value)) throw incompatible(path, 'JSON does not support Infinity or NaN.');

  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw incompatible(
      path,
      'Quote integers outside ±9,007,199,254,740,991 to preserve their exact digits as strings.',
    );
  }

  return value;
}

function containerToJson(
  value: object,
  path: string,
  depth: number,
  state: ConversionState,
): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry: unknown, index: number) =>
      toJsonValue(entry, `${path}[${index}]`, depth + 1, state),
    );
  }

  if (value instanceof Map) {
    const entries: Array<[string, JsonValue]> = [];

    for (const [key, entry] of value) {
      if (typeof key !== 'string')
        throw incompatible(path, 'JSON object keys must be strings, not collections or aliases.');

      entries.push([key, toJsonValue(entry, `${path}[${JSON.stringify(key)}]`, depth + 1, state)]);
    }

    return Object.fromEntries(entries);
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw incompatible(path, 'YAML-only value types cannot be represented in JSON.');
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]: [string, unknown]) => [
      key,
      toJsonValue(entry, `${path}[${JSON.stringify(key)}]`, depth + 1, state),
    ]),
  );
}

function incompatible(path: string, message: string): FunctionError {
  return new FunctionError('YAML_NOT_JSON_COMPATIBLE', `${message} At ${path}.`);
}
