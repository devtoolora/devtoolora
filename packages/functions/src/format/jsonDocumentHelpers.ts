import { FunctionError } from '../errors';

export interface JsonDocumentReport {
  arrays: number;
  duplicateKeys: number;
  maxDepth: number;
  numbersOutsideSafeRange: number;
  objects: number;
  rootType: string;
  valid: true;
  values: number;
  warnings: string[];
}

export interface JsonDocumentOptions {
  collectTree?: boolean;
  indentation?: '2' | '4' | 'tab';
  /** Overrides the caps; defaults are 1,000,000 characters and 100,000 values (5,000 in a tree). */
  limits?: { characters?: number; values?: number };
  lineEnding?: 'lf' | 'crlf';
  mode?: 'format' | 'minify' | 'validate';
}

export interface JsonDocumentResult {
  nodes: JsonDocumentNode[];
  report: JsonDocumentReport;
  text: string;
}

export interface JsonDocumentNode {
  childCount: number;
  depth: number;
  end: number;
  id: number;
  label: string;
  parentId: number | null;
  pointer: string;
  start: number;
  token: string;
  type: 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
}

export interface JsonDuplicateKeys {
  count: number;
  key: string;
  line: number;
}

export function duplicateKeysWarning(
  duplicates: JsonDuplicateKeys | undefined,
  outcome = 'is kept',
): string | undefined {
  if (!duplicates) return undefined;

  const { count, key, line } = duplicates;
  const where = `Duplicate key ${JSON.stringify(key.slice(0, 64))} at line ${line}`;

  return count === 1
    ? `${where}; only its last value ${outcome}.`
    : `${where} and ${count - 1} more; only the last value of each ${outcome}.`;
}

export function isOutOfDoubleRange(number: string): boolean {
  const value = Number(number);

  return !Number.isFinite(value) || (value === 0 && /[1-9]/.test(number.split(/[eE]/)[0] ?? ''));
}

export function formatJsonTokens(tokens: string[], indent: string, newline: string): string {
  const output: string[] = [];
  let depth = 0;
  let length = 0;

  function append(text: string): void {
    length += text.length;
    if (length > 8_000_000)
      throw new FunctionError(
        'JSON_LIMIT',
        'Formatted JSON is limited to 8,000,000 characters. Reduce indentation or use Minify.',
      );

    output.push(text);
  }

  for (const [index, token] of tokens.entries()) {
    if (token === '{' || token === '[') {
      append(token);
      depth += 1;
      if (tokens[index + 1] !== (token === '{' ? '}' : ']')) append(newline + indent.repeat(depth));
    } else if (token === '}' || token === ']') {
      depth -= 1;
      if (tokens[index - 1] !== (token === '}' ? '{' : '[')) append(newline + indent.repeat(depth));

      append(token);
    } else if (token === ',') append(',' + newline + indent.repeat(depth));
    else if (token === ':') append(': ');
    else append(token);
  }

  return output.join('');
}

export function checkJsonLength(source: string, options: JsonDocumentOptions): void {
  const limit = options.limits?.characters ?? 1_000_000;

  if (source.length > limit)
    throw new FunctionError(
      'JSON_LIMIT',
      `JSON input is limited to ${limit.toLocaleString('en-US')} characters.`,
    );
}
