import { FunctionError } from '../errors';
import {
  duplicateKeysWarning,
  JsonNumberToken,
  jsonToYaml,
  parseLosslessJsonData,
  yamlToJson,
  type JsonValue,
  type LosslessJsonValue,
} from '../format';
import {
  formatDotenv,
  inspectDotenv,
  parseDotenv,
  type DotenvAssignment,
  type DotenvDocument,
  type DotenvLine,
} from './dotenv';

export const dotenvConversions = [
  'env-to-json',
  'env-to-yaml',
  'example',
  'json-to-env',
  'yaml-to-env',
] as const;

export type DotenvConversion = (typeof dotenvConversions)[number];

const MAX_VARIABLES = 10_000;
const MAX_ECHO = 64;
const MAX_INPUT = 1_048_576;
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function convertDotenv(
  text: string,
  conversion: DotenvConversion,
  options: { keepComments?: boolean; placeholder?: string } = {},
): { text: string; variables: number; warning?: string } {
  if (conversion === 'example') return exampleFile(text, options);

  if (conversion === 'json-to-env') {
    const { duplicates, value } = parseJson(text);
    const warning = duplicateKeysWarning(duplicates);

    return { ...objectToDotenv(value), ...(warning ? { warning } : {}) };
  }

  if (conversion === 'yaml-to-env') return objectToDotenv(parseYaml(text));

  const document = uniqueDocument(text);
  const object = dotenvToObject(document);
  const warning = attachedCommentWarning(document);

  return {
    text: conversion === 'env-to-json' ? JSON.stringify(object, null, 2) : jsonToYaml(object),
    variables: Object.keys(object).length,
    ...(warning ? { warning } : {}),
  };
}

function attachedCommentWarning(document: DotenvDocument): string | undefined {
  const count = assignments(document.lines).filter((line) => line.attachedComment).length;

  if (count === 0) return undefined;

  return `${count} # without a space before ${count === 1 ? 'it was' : 'them were'} read as a comment; sh and other dotenv readers keep it in the value, so quote the value if it belongs there.`;
}

function assignments(lines: DotenvLine[]): DotenvAssignment[] {
  return lines.filter((line): line is DotenvAssignment => line.kind === 'assignment');
}

function uniqueDocument(text: string): DotenvDocument {
  const document = inspectDotenv(text);

  const keys = new Set<string>();
  const duplicateLines = new Set<number>();
  let firstDuplicate: DotenvAssignment | undefined;

  for (const line of assignments(document.lines)) {
    if (keys.has(line.key)) {
      duplicateLines.add(line.lineNumber);
      firstDuplicate ??= line;
    }

    keys.add(line.key);
  }

  if (document.diagnostics.some((item) => !duplicateLines.has(item.lineNumber))) parseDotenv(text);

  if (firstDuplicate)
    throw new FunctionError(
      'INVALID_CONFIG',
      `Duplicate variable "${firstDuplicate.key.slice(0, MAX_ECHO)}" on line ${firstDuplicate.lineNumber}.`,
    );

  return document;
}

function dotenvToObject(document: DotenvDocument): Record<string, JsonValue> {
  const entries = new Map<string, string>();

  for (const line of assignments(document.lines)) {
    entries.set(line.key, line.quote === '"' ? unescapeDouble(line.value) : line.value);
  }

  checkVariableCount(entries.size);

  return Object.fromEntries(entries);
}

function exampleFile(
  text: string,
  options: { keepComments?: boolean; placeholder?: string },
): { text: string; variables: number } {
  const keepComments = options.keepComments ?? true;
  const placeholder = options.placeholder ?? '';
  const document = uniqueDocument(text);

  checkVariableCount(assignments(document.lines).length);

  const lines = document.lines
    .filter((line) => keepComments || line.kind !== 'comment')
    .map((line): DotenvLine => {
      if (line.kind !== 'assignment') return line;

      return {
        ...line,
        inlineComment: keepComments && !line.attachedComment ? line.inlineComment : undefined,
        quote: undefined,
        ...quoteValue(placeholder),
      };
    });

  return {
    text: formatDotenv({ ...document, lines }),
    variables: assignments(document.lines).length,
  };
}

const ESCAPES: Record<string, string> = { '\\': '\\', '"': '"', n: '\n', r: '\r', t: '\t' };

// The shared parser keeps double-quoted text raw, so decode it here only.
function unescapeDouble(value: string): string {
  return value.replace(/\\(.)/gs, (match, char: string) => ESCAPES[char] ?? match);
}

function checkVariableCount(count: number): void {
  if (count > MAX_VARIABLES)
    throw new FunctionError('INVALID_CONFIG', 'Input exceeds 10,000 variables.');
}

function checkLength(text: string): void {
  if (text.length > MAX_INPUT)
    throw new FunctionError('INVALID_CONFIG', 'Input exceeds 1,048,576 characters.');
}

// Lossless, because a variable is text: 12345678901234567890 and 1.10 keep their digits.
function parseJson(text: string): ReturnType<typeof parseLosslessJsonData> {
  checkLength(text);

  try {
    return parseLosslessJsonData(text);
  } catch {
    throw new FunctionError('INVALID_JSON', 'Input is not valid JSON.');
  }
}

function parseYaml(text: string): JsonValue {
  checkLength(text);

  try {
    return yamlToJson(text);
  } catch {
    // The YAML parser quotes input lines in its messages, which could leak secrets.
    throw new FunctionError('INVALID_YAML', 'Input is not valid YAML.');
  }
}

function objectToDotenv(value: JsonValue | LosslessJsonValue): { text: string; variables: number } {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof JsonNumberToken
  )
    throw new FunctionError('INVALID_CONFIG', 'Input must be an object of variables.');

  const entries: Array<[string, JsonValue | LosslessJsonValue]> =
    value instanceof Map ? [...value.entries()] : Object.entries(value);

  checkVariableCount(entries.length);

  const lines: DotenvAssignment[] = entries.map(([key, item], index) => {
    const shown = key.slice(0, MAX_ECHO);

    if (!VARIABLE_NAME.test(key))
      throw new FunctionError('INVALID_CONFIG', `Key "${shown}" is not a valid variable name.`);

    if (Array.isArray(item))
      throw new FunctionError(
        'INVALID_CONFIG',
        `Value of "${shown}" is an array; flatten nested values first (JSON Flattener).`,
      );

    if (item instanceof JsonNumberToken)
      return {
        exportPrefix: false,
        key,
        kind: 'assignment',
        lineNumber: index + 1,
        value: item.text,
      };

    if (item !== null && typeof item === 'object')
      throw new FunctionError(
        'INVALID_CONFIG',
        `Value of "${shown}" is an object; flatten nested values first (JSON Flattener).`,
      );

    return {
      exportPrefix: false,
      key,
      kind: 'assignment',
      lineNumber: index + 1,
      ...quoteValue(item),
    };
  });
  const document: DotenvDocument = { diagnostics: [], endsWithNewline: lines.length > 0, lines };

  return { text: formatDotenv(document), variables: lines.length };
}

function quoteValue(
  value: string | number | boolean | null,
): Pick<DotenvAssignment, 'quote' | 'value'> {
  const raw = value === null ? '' : String(value);

  if (!/[\s#"'\\$]/.test(raw)) return { value: raw };

  // sh expands $ inside double quotes; single quotes keep it but cannot hold a quote or newline.
  if (raw.includes('$') && !/['\r\n]/.test(raw)) return { quote: "'", value: raw };

  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');

  return { quote: '"', value: escaped };
}
