import { FunctionError } from '../errors';
import {
  JsonNumberToken,
  parseLosslessJsonData,
  type JsonDuplicateKeys,
  type LosslessJsonValue,
} from './jsonDocument';
import { duplicateKeysWarning, isOutOfDoubleRange } from './jsonDocumentHelpers';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ExactJsonValue =
  | null
  | boolean
  | number
  | string
  | JsonNumberToken
  | ExactJsonValue[]
  | { [key: string]: ExactJsonValue };

const unsafeIntegerMessage =
  'Quote integers outside ±9,007,199,254,740,991 to preserve their exact digits as strings.';
const outOfRangeMessage =
  'A number such as 1e400 or 1e-400 is beyond the range of a double and would become null or 0; quote it as a string.';
// Valid JSON only, so a string is read as a whole and anything else that starts with a digit is a
// number.
const jsonStringOrNumber = /"(?:[^"\\]|\\.)*"|-?\d[\d.eE+-]*/g;

function rejectUnsafeInteger(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value))
    throw new FunctionError('UNSAFE_INTEGER', unsafeIntegerMessage);

  return value;
}

export function rejectOutOfRangeNumbers(text: string): void {
  for (const [token] of text.matchAll(jsonStringOrNumber)) {
    if (!token.startsWith('"') && isOutOfDoubleRange(token))
      throw new FunctionError('NON_FINITE_NUMBER', outOfRangeMessage);
  }
}

/**
 * JSON.parse that throws a FunctionError instead of silently rounding integers beyond ±(2^53 − 1),
 * or turning a number beyond the double range into Infinity (written as null) or 0. For a caller
 * that computes on the values; one that only passes them on should use parseExactJson.
 */
export function parseJsonExactIntegers(text: string): unknown {
  const value: unknown = JSON.parse(text, rejectUnsafeInteger);

  rejectOutOfRangeNumbers(text);

  return value;
}

// 1.50 and 1.5, or 1e3 and 1000, spell the same digits; a rounded value spells different ones.
function significantDigits(number: string): string {
  return number
    .replace(/[eE].*$/, '')
    .replace(/[-.]/g, '')
    .replace(/^0+/, '')
    .replace(/(?<!0)0+$/, '');
}

function toExactValue(value: LosslessJsonValue): ExactJsonValue {
  if (value instanceof JsonNumberToken) {
    const double = Number(value.text);

    return significantDigits(String(double)) === significantDigits(value.text) ? double : value;
  }

  if (Array.isArray(value)) return value.map(toExactValue);

  // fromEntries defines own data properties, so a "__proto__" key stays plain data.
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([key, item]) => [key, toExactValue(item)]));

  return value;
}

export function parseExactJson(
  text: string,
  options: { keepOutOfRange?: boolean } = {},
): { duplicates: JsonDuplicateKeys | undefined; value: ExactJsonValue } {
  const { duplicates, value } = parseLosslessJsonData(text, { depth: 1_000 });

  if (!options.keepOutOfRange) rejectOutOfRangeNumbers(text);

  return { duplicates, value: toExactValue(value) };
}

export function jsonDuplicateWarning(text: string, outcome?: string): string | undefined {
  try {
    return duplicateKeysWarning(parseLosslessJsonData(text).duplicates, outcome);
  } catch {
    return undefined;
  }
}

export function keepLastDuplicateValues(source: string): string {
  try {
    const { duplicates, value } = parseLosslessJsonData(source);

    return duplicates ? stringifyLosslessJson(value) : source;
  } catch {
    return source;
  }
}

export function stringifyLosslessJson(value: LosslessJsonValue): string {
  if (value instanceof JsonNumberToken) return value.text;
  if (Array.isArray(value)) return `[${value.map(stringifyLosslessJson).join(',')}]`;
  if (value instanceof Map)
    return `{${[...value].map(([key, entry]) => `${JSON.stringify(key)}:${stringifyLosslessJson(entry)}`).join(',')}}`;

  return JSON.stringify(value);
}

export function stringifyExactJson(value: unknown, space: number | string = ''): string {
  const indent = typeof space === 'number' ? ' '.repeat(space) : space;

  const write = (item: unknown, pad: string): string => {
    if (item instanceof JsonNumberToken) return item.text;
    if (item === null || typeof item !== 'object') return JSON.stringify(item);

    const inner = pad + indent;
    const isList = Array.isArray(item);
    const parts = isList
      ? item.map((entry: unknown) => write(entry, inner))
      : Object.entries(item)
          .filter(([, entry]) => entry !== undefined)
          .map(([key, entry]) => `${JSON.stringify(key)}:${indent && ' '}${write(entry, inner)}`);
    const [open, close] = isList ? '[]' : '{}';

    if (parts.length === 0) return `${open}${close}`;

    return indent
      ? `${open}\n${inner}${parts.join(`,\n${inner}`)}\n${pad}${close}`
      : `${open}${parts.join(',')}${close}`;
  };

  return write(value, '');
}

export function parseJson(text: string, options: { exactIntegers?: boolean } = {}): JsonValue {
  const input = text.trim();

  if (!input) throw new FunctionError('REQUIRED_JSON', 'JSON input is required.');

  try {
    return (options.exactIntegers ? parseJsonExactIntegers(input) : JSON.parse(input)) as JsonValue;
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw new FunctionError(
      'INVALID_JSON',
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
