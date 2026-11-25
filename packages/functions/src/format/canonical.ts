import { FunctionError } from '../errors';
import type { JsonValue } from './json';
import { processJsonDocument } from './jsonDocument';

const MAX_DEPTH = 64;
const NESTING_MESSAGE = `Nesting is limited to ${MAX_DEPTH} levels.`;

// A surrogate that is not half of a pair; JSON.stringify would write it as an escape.
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

type PrintRules = { desc: boolean; rfc8785: boolean };

// Plain string comparison orders by UTF-16 code units, as RFC 8785 requires.
function compareKeys(left: string, right: string): number {
  if (left === right) return 0;

  return left < right ? -1 : 1;
}

// RFC 8785 sections 3.2.2.2 and 3.2.2.3 require an error for these two.
function assertCanonical(value: JsonValue): void {
  if (typeof value === 'string' && loneSurrogate.test(value))
    throw new FunctionError(
      'INVALID_JSON',
      'RFC 8785 rejects a string with an unpaired surrogate such as \\ud83d.',
    );
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new FunctionError(
      'NON_FINITE_NUMBER',
      'RFC 8785 rejects a number beyond the range of a double, such as 1e400.',
    );
}

// Printed from the sorted entries: a plain object would list integer-like keys first again.
function printSorted(value: JsonValue, rules: PrintRules, depth: number): string {
  if (rules.rfc8785) assertCanonical(value);
  // Scalars use ES JSON.stringify, which is the RFC 8785 number and string form; -0 gives 0.
  if (typeof value !== 'object' || value === null) return JSON.stringify(value);
  if (depth > MAX_DEPTH) throw new FunctionError('LIMIT', NESTING_MESSAGE);

  if (Array.isArray(value))
    return `[${value.map((item) => printSorted(item, rules, depth + 1)).join(',')}]`;

  const entries = Object.entries(value).sort(([left], [right]) => compareKeys(left, right));

  if (rules.desc) entries.reverse();

  const members = entries.map(([key, item]) => {
    if (rules.rfc8785) assertCanonical(key);

    return `${JSON.stringify(key)}:${printSorted(item, rules, depth + 1)}`;
  });

  return `{${members.join(',')}}`;
}

export function canonicalizeJson(value: JsonValue): string {
  return printSorted(value, { desc: false, rfc8785: true }, 1);
}

export function sortJsonKeys(
  value: JsonValue,
  options: { indentation: 2 | 4 | 'tab'; order: 'asc' | 'desc' },
): string {
  const compact = printSorted(value, { desc: options.order === 'desc', rfc8785: false }, 1);

  return processJsonDocument(compact, {
    indentation: String(options.indentation) as '2' | '4' | 'tab',
    limits: { characters: Number.POSITIVE_INFINITY, values: Number.POSITIVE_INFINITY },
  }).text;
}
