import { FunctionError } from '../errors';
import { requiredText } from './shared';
import { jsonDocumentToToml } from './toml';
import { quoteTomlDates } from './tomlDates';
import { parse as parseToml, TomlError } from 'smol-toml';

export interface TomlFormatOptions {
  mode: 'format' | 'validate';
}

export interface TomlFormatResult {
  comments: number;
  text: string;
}

const maxDepth = 128;
const maxLength = 5_000_000;

export function formatToml(input: string, options: TomlFormatOptions): TomlFormatResult {
  if (input.length > maxLength) {
    throw new FunctionError('TOML_TOO_LARGE', 'TOML input is limited to 5,000,000 characters.');
  }

  requiredText(input, 'TOML');

  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const comments = countComments(source);

  if (options.mode === 'validate') {
    parse(source);

    return { comments, text: input };
  }

  // Dates and numbers are carried as strings starting with a prefix that the parsed document
  // cannot contain elsewhere, so they are written back unquoted and cannot be spoofed.
  for (let attempt = 0; attempt < 5; attempt++) {
    const prefix = `~toml${attempt}:`;
    const quoted = quoteTomlDates(source, prefix);
    const parsed = parse(quoted.text);
    const json = serialize(parsed, prefix, 0);
    const marked = json.split(`"${prefix}`).length - 1;

    if (marked === quoted.dates + countNumbers(parsed)) {
      const raw = new RegExp(`"${prefix.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}([^"]*)"`, 'g');
      const text = json === '{}' ? '' : toToml(json).replace(raw, '$1');

      return { comments, text };
    }
  }

  throw new FunctionError(
    'UNSUPPORTED_TOML_FORMAT',
    'This TOML cannot be formatted without data loss.',
  );
}

function toToml(json: string): string {
  try {
    return jsonDocumentToToml(json, 'tables', {
      characters: Number.POSITIVE_INFINITY,
      values: Number.POSITIVE_INFINITY,
    });
  } catch (error) {
    if (error instanceof FunctionError && error.code === 'JSON_LIMIT')
      throw new FunctionError(
        'TOML_LIMIT',
        'TOML formatting supports 128 nested levels and 8,000,000 characters of key paths.',
      );

    throw error;
  }
}

function parse(source: string): unknown {
  try {
    return parseToml(source, { integersAsBigInt: true });
  } catch (error) {
    if (error instanceof TomlError)
      throw new FunctionError(
        'INVALID_TOML',
        `TOML line ${error.line}, column ${error.column}: ${error.message}`,
      );

    throw new FunctionError('INVALID_TOML', 'Invalid TOML.');
  }
}

function countNumbers(value: unknown): number {
  if (typeof value === 'bigint' || typeof value === 'number') return 1;
  if (Array.isArray(value))
    return value.reduce((sum: number, entry) => sum + countNumbers(entry), 0);
  if (value && typeof value === 'object')
    return Object.values(value).reduce((sum: number, entry) => sum + countNumbers(entry), 0);

  return 0;
}

// Builds JSON text by hand so integer-like keys keep their order.
function serialize(value: unknown, prefix: string, depth: number): string {
  if (depth > maxDepth)
    throw new FunctionError('TOML_LIMIT', 'TOML formatting supports 128 nested levels.');
  if (typeof value === 'bigint') {
    if (value < -(1n << 63n) || value > (1n << 63n) - 1n)
      throw new FunctionError(
        'TOML_INTEGER_RANGE',
        'TOML integers must fit the signed 64-bit range.',
      );

    return JSON.stringify(`${prefix}${value}`);
  }
  if (typeof value === 'number') return JSON.stringify(`${prefix}${floatText(value)}`);
  if (Array.isArray(value))
    return `[${value.map((entry) => serialize(entry, prefix, depth + 1)).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date))
    return `{${Object.entries(value)
      .map(([key, entry]) => `${JSON.stringify(key)}:${serialize(entry, prefix, depth + 1)}`)
      .join(',')}}`;

  return JSON.stringify(value);
}

function floatText(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf';
  if (Object.is(value, -0)) return '-0.0';

  const text = String(value);

  return /[.e]/.test(text) ? text : `${text}.0`;
}

function countComments(source: string): number {
  let comments = 0;
  let offset = 0;

  while (offset < source.length) {
    const character = source.charAt(offset);

    if (character === '#') {
      comments++;
      while (offset < source.length && source[offset] !== '\n') offset++;
    } else if (character === '"' || character === "'") {
      offset = skipString(source, offset, character);
    } else offset++;
  }

  return comments;
}

function skipString(source: string, start: number, quote: string): number {
  const delimiter = source.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote;
  let offset = start + delimiter.length;

  while (offset < source.length) {
    if (quote === '"' && source[offset] === '\\') offset += 2;
    else if (source.startsWith(delimiter, offset)) return offset + delimiter.length;
    else if (delimiter.length === 1 && source[offset] === '\n') return offset;
    else offset++;
  }

  return offset;
}
