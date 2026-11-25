import { FunctionError } from '../errors';
import { parseExactJson, stringifyExactJson, type ExactJsonValue } from './json';
import { JsonSyntaxError, type JsonDuplicateKeys } from './jsonDocument';

const MAX_UNITS = 10_000_000;
const MAX_LINES = 100_000;

export type JsonLinesParseResult = {
  blankSkipped: number;
  duplicates: JsonDuplicateKeys | undefined;
  lines: number;
  value: ExactJsonValue[];
};

function lineError(lineNumber: number, error: unknown): FunctionError {
  if (error instanceof JsonSyntaxError) {
    const reason = error.reason.replace(/\.$/, '');

    return new FunctionError(
      error.code,
      `Line ${lineNumber} is not valid JSON: ${reason} at column ${error.offset + 1}.`,
    );
  }

  if (error instanceof FunctionError)
    return new FunctionError(error.code, `Line ${lineNumber}: ${error.message}`);

  return new FunctionError('INVALID_JSON', `Line ${lineNumber} is not valid JSON.`);
}

export function jsonLinesToArray(text: string): JsonLinesParseResult {
  if (text.length > MAX_UNITS) {
    throw new FunctionError('LIMIT', 'Input is limited to 10,000,000 UTF-16 units.');
  }

  const rows = text.replace(/^\uFEFF/, '').split(/\r\n?|\n/);

  if (rows[rows.length - 1] === '') rows.pop();

  if (rows.length > MAX_LINES) {
    throw new FunctionError('LIMIT', 'Input is limited to 100,000 lines.');
  }

  const value: ExactJsonValue[] = [];
  let blankSkipped = 0;
  let duplicates: JsonDuplicateKeys | undefined;

  for (const [index, row] of rows.entries()) {
    if (!row.trim()) {
      blankSkipped += 1;

      continue;
    }

    try {
      const parsed = parseExactJson(row);

      value.push(parsed.value);
      if (parsed.duplicates)
        duplicates = {
          count: (duplicates?.count ?? 0) + parsed.duplicates.count,
          key: duplicates?.key ?? parsed.duplicates.key,
          line: duplicates?.line ?? index + 1,
        };
    } catch (error) {
      throw lineError(index + 1, error);
    }
  }

  if (!value.length) throw new FunctionError('REQUIRED_JSON', 'JSON Lines input is required.');

  return { blankSkipped, duplicates, lines: value.length, value };
}

export function jsonArrayToLines(value: ExactJsonValue): string {
  if (!Array.isArray(value)) {
    throw new FunctionError('INVALID_JSON', 'Input must be a top-level JSON array.');
  }

  if (value.length > MAX_LINES) {
    throw new FunctionError('LIMIT', 'Output is limited to 100,000 lines.');
  }

  return value.map((item) => stringifyExactJson(item)).join('\n');
}
