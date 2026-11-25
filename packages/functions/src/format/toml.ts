import { parse as parseToml, TomlError } from 'smol-toml';
import { FunctionError } from '../errors';
import {
  processJsonDocument,
  type JsonDocumentNode,
  type JsonDocumentOptions,
} from './jsonDocument';
import { keepLastDuplicateValues } from './json';
import { quoteTomlDates } from './tomlDates';

export interface TomlJsonResult {
  dates: number;
  largeIntegers: number;
  text: string;
}

export function jsonDocumentToToml(
  source: string,
  layout: 'tables' | 'inline' = 'tables',
  limits?: JsonDocumentOptions['limits'],
): string {
  if (layout !== 'tables' && layout !== 'inline')
    throw new FunctionError('INVALID_TOML_OPTIONS', 'Choose table sections or inline objects.');

  const document = processJsonDocument(keepLastDuplicateValues(source), {
    collectTree: true,
    limits,
    mode: 'minify',
  });

  const [root] = document.nodes;

  if (root?.type !== 'object')
    throw new FunctionError('INVALID_JSON_TOML', 'JSON to TOML requires a root object.');

  const children = new Map<number, JsonDocumentNode[]>();

  for (const node of document.nodes) {
    if (node.parentId === null) continue;

    const siblings = children.get(node.parentId) ?? [];

    siblings.push(node);
    children.set(node.parentId, siblings);
  }

  const writer: TomlWriter = { children, layout };

  const output = tomlSection(writer, root, []).join('\n').replace(/^\n+/, '');

  if (output.length > 8_000_000)
    throw new FunctionError('TOML_LIMIT', 'TOML output is limited to 8,000,000 characters.');

  return output ? `${output}\n` : '# Empty JSON object\n';
}

type TomlWriter = {
  children: Map<number, JsonDocumentNode[]>;
  layout: 'tables' | 'inline';
};

function tomlMembers(writer: TomlWriter, node: JsonDocumentNode): JsonDocumentNode[] {
  return writer.children.get(node.id) ?? [];
}

function tomlKey(node: JsonDocumentNode): string {
  const name: string = JSON.parse(node.label);

  return /^[A-Za-z0-9_-]+$/.test(name) ? name : tomlString(name);
}

function tomlInline(writer: TomlWriter, node: JsonDocumentNode): string {
  if (node.type === 'null')
    throw new FunctionError(
      'NULL_JSON_TOML',
      `TOML has no null value: JSON Pointer ${JSON.stringify(node.pointer)}. Remove the property or choose an explicit replacement in your source.`,
    );
  if (node.type === 'object')
    return node.childCount
      ? `{ ${tomlMembers(writer, node)
          .map((child) => `${tomlKey(child)} = ${tomlInline(writer, child)}`)
          .join(', ')} }`
      : '{}';
  if (node.type === 'array')
    return `[${tomlMembers(writer, node)
      .map((child) => tomlInline(writer, child))
      .join(', ')}]`;
  if (node.type === 'string') return tomlString(JSON.parse(node.token));
  if (node.type === 'boolean') return node.token;
  if (/^-?\d+$/.test(node.token)) {
    const integer = BigInt(node.token);

    if (integer < -(1n << 63n) || integer > (1n << 63n) - 1n)
      throw new FunctionError(
        'TOML_INTEGER_RANGE',
        `Integer at ${JSON.stringify(node.pointer)} is outside TOML's signed 64-bit range. Quote it in JSON to keep it as text.`,
      );
  } else if (!Number.isFinite(Number(node.token)))
    throw new FunctionError(
      'TOML_FLOAT_RANGE',
      `Float at ${JSON.stringify(node.pointer)} is outside the finite binary64 range. Quote it to preserve its digits as text.`,
    );

  return node.token;
}

function tomlSection(
  writer: TomlWriter,
  node: JsonDocumentNode,
  path: string[],
  arrayTable = false,
): string[] {
  const lines = path.length ? [arrayTable ? `[[${path.join('.')}]]` : `[${path.join('.')}]`] : [];
  const deferred: JsonDocumentNode[] = [];

  for (const child of tomlMembers(writer, node)) {
    const isObjectArray =
      child.type === 'array' &&
      child.childCount > 0 &&
      tomlMembers(writer, child).every((entry) => entry.type === 'object');

    if (
      writer.layout === 'tables' &&
      ((child.type === 'object' && child.childCount > 0) || isObjectArray)
    )
      deferred.push(child);
    else lines.push(`${tomlKey(child)} = ${tomlInline(writer, child)}`);
  }

  for (const child of deferred) {
    const childPath = [...path, tomlKey(child)];
    const sections =
      child.type === 'array'
        ? tomlMembers(writer, child).map((entry) => tomlSection(writer, entry, childPath, true))
        : [tomlSection(writer, child, childPath)];

    for (const block of sections) lines.push('', ...block);
  }

  return lines;
}

export function tomlDocumentToJson(
  source: string,
  largeIntegers: 'numbers' | 'strings' = 'numbers',
  indentation: '2' | '4' = '2',
): TomlJsonResult {
  if (largeIntegers !== 'numbers' && largeIntegers !== 'strings')
    throw new FunctionError(
      'INVALID_TOML_OPTIONS',
      'Choose exact JSON numbers or strings for large integers.',
    );
  if (indentation !== '2' && indentation !== '4')
    throw new FunctionError('INVALID_TOML_OPTIONS', 'Choose two- or four-space JSON indentation.');
  if (source.length > 1_000_000)
    throw new FunctionError('TOML_LIMIT', 'TOML input is limited to 1,000,000 characters.');

  try {
    // First parse validates original syntax so errors keep the source line and column.
    parseToml(source, { integersAsBigInt: true });
    const quoted = quoteTomlDates(source);
    const parsed = parseToml(quoted.text, { integersAsBigInt: true });
    const state: TomlSerializer = { largeIntegers, unsafeIntegers: 0, values: 0 };
    const compact = serializeTomlValue(state, parsed, 0);

    return {
      dates: quoted.dates,
      largeIntegers: state.unsafeIntegers,
      text: processJsonDocument(compact, { indentation, mode: 'format' }).text,
    };
  } catch (error) {
    if (error instanceof FunctionError) throw error;
    if (error instanceof TomlError)
      throw new FunctionError(
        'INVALID_TOML',
        `TOML line ${error.line}, column ${error.column}: ${error.message}`,
      );

    throw new FunctionError(
      'INVALID_TOML',
      `Invalid TOML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

type TomlSerializer = {
  largeIntegers: 'numbers' | 'strings';
  unsafeIntegers: number;
  values: number;
};

function serializeTomlValue(state: TomlSerializer, value: unknown, depth: number): string {
  if (++state.values > 5_000 || depth > 128)
    throw new FunctionError(
      'TOML_LIMIT',
      'TOML conversion supports 5,000 values and 128 nested levels.',
    );

  if (typeof value === 'bigint') return serializeTomlInteger(state, value);

  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new FunctionError(
        'NONFINITE_TOML_JSON',
        'TOML inf and nan cannot be represented as JSON. Replace them with finite values or quoted text.',
      );

    return Object.is(value, -0) ? '-0' : String(value);
  }

  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => serializeTomlValue(state, entry, depth + 1)).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date))
    return `{${Object.entries(value)
      .map(
        ([name, entry]) => `${JSON.stringify(name)}:${serializeTomlValue(state, entry, depth + 1)}`,
      )
      .join(',')}}`;

  throw new FunctionError(
    'UNSUPPORTED_TOML_JSON',
    'A TOML value could not be converted without data loss.',
  );
}

function serializeTomlInteger(state: TomlSerializer, value: bigint): string {
  if (value < -(1n << 63n) || value > (1n << 63n) - 1n)
    throw new FunctionError(
      'TOML_INTEGER_RANGE',
      'TOML integers must fit the signed 64-bit range. Quote larger values as text.',
    );

  const isLarge =
    value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER);

  if (isLarge) state.unsafeIntegers++;

  return isLarge && state.largeIntegers === 'strings'
    ? JSON.stringify(value.toString())
    : value.toString();
}

function tomlString(text: string): string {
  if (/[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TOML_UNICODE',
      'TOML strings and keys cannot contain unpaired Unicode surrogates.',
    );

  return JSON.stringify(text).replace(/\u007f/g, '\\u007f');
}
