import { FunctionError } from '../errors';
import { parseExactJson } from '../format/json';
import { JsonNumberToken, JsonSyntaxError } from '../format/jsonDocument';

export type ListInputFormat = 'auto' | 'comma' | 'json' | 'lines' | 'semicolon' | 'space' | 'tab';
export type ListOutputFormat = 'comma' | 'custom' | 'json' | 'lines' | 'sql';
export type ListConvertOptions = {
  dedupe: boolean;
  dropEmpty: boolean;
  input: ListInputFormat;
  output: ListOutputFormat;
  quote: 'double' | 'none' | 'single';
  separator?: string;
  trim: boolean;
};
export type ListConvertResult = {
  duplicatesRemoved: number;
  emptyDropped: number;
  inputFormat: Exclude<ListInputFormat, 'auto'>;
  items: string[];
  text: string;
};
type DetectedFormat = Exclude<ListInputFormat, 'auto'>;

const maxUnits = 100_000;
const maxItems = 10_000;
const jsonError = 'JSON input must be an array of strings, numbers, booleans or null.';

function parseJsonList(text: string): string[] | undefined {
  let value: unknown;

  try {
    ({ value } = parseExactJson(text));
  } catch (error) {
    if (error instanceof JsonSyntaxError) return undefined;

    throw error;
  }

  if (!Array.isArray(value)) return undefined;
  if (
    value.some(
      (item) => typeof item === 'object' && item !== null && !(item instanceof JsonNumberToken),
    )
  )
    throw new FunctionError('INVALID_LIST', jsonError);

  return value.map(String);
}

const withoutFinalNewline = (text: string): string => text.replace(/\r?\n$/, '');

function detectFormat(text: string): DetectedFormat {
  if (text.trim().startsWith('[') && parseJsonList(text.trim())) return 'json';
  if (withoutFinalNewline(text).includes('\n')) return 'lines';
  if (text.includes(',')) return 'comma';
  if (text.includes(';')) return 'semicolon';
  if (text.includes('\t')) return 'tab';

  return text.includes(' ') ? 'space' : 'lines';
}

const splitters: Record<Exclude<DetectedFormat, 'json'>, string | RegExp> = {
  comma: ',',
  lines: /\r\n|\r|\n/,
  semicolon: ';',
  space: ' ',
  tab: '\t',
};

function splitItems(text: string, format: DetectedFormat): string[] {
  if (format !== 'json') return text.split(splitters[format]);

  const items = parseJsonList(text.trim());

  if (!items) throw new FunctionError('INVALID_LIST', 'Input is not a valid JSON array.');

  return items;
}

function quoteItem(item: string, quote: ListConvertOptions['quote']): string {
  if (quote === 'single') return `'${item.replaceAll("'", "''")}'`;

  return quote === 'double' ? `"${item.replaceAll('"', '\\"')}"` : item;
}

function formatItems(items: string[], options: ListConvertOptions): string {
  const quoted = () => items.map((item) => quoteItem(item, options.quote));

  if (options.output === 'json') return JSON.stringify(items);
  if (options.output === 'sql')
    return `(${items.map((item) => quoteItem(item, 'single')).join(', ')})`;
  if (options.output === 'lines') return quoted().join('\n');
  if (options.output === 'comma') return quoted().join(', ');

  return quoted().join(options.separator);
}

function validateInput(text: string, options: ListConvertOptions): void {
  if (text.length > maxUnits)
    throw new FunctionError('INVALID_LIST', 'Input is limited to 100,000 UTF-16 units.');
  if (options.output !== 'custom') return;

  const length = options.separator?.length ?? 0;

  if (length < 1 || length > 32)
    throw new FunctionError('INVALID_LIST', 'Separator must be 1 to 32 UTF-16 units.');
}

export function convertList(text: string, options: ListConvertOptions): ListConvertResult {
  validateInput(text, options);

  const inputFormat = options.input === 'auto' ? detectFormat(text) : options.input;
  let items = splitItems(
    options.input === 'auto' && inputFormat !== 'lines' ? withoutFinalNewline(text) : text,
    inputFormat,
  );
  let emptyDropped = 0;
  let duplicatesRemoved = 0;

  if (options.trim) items = items.map((item) => item.trim());
  if (options.dropEmpty) {
    const kept = items.filter((item) => item !== '');

    emptyDropped = items.length - kept.length;
    items = kept;
  }
  if (items.length > maxItems)
    throw new FunctionError('INVALID_LIST', 'Input is limited to 10,000 items.');
  if (options.dedupe) {
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const key = item.trim();

      if (seen.has(key)) return false;

      seen.add(key);

      return true;
    });

    duplicatesRemoved = items.length - unique.length;
    items = unique;
  }

  return { duplicatesRemoved, emptyDropped, inputFormat, items, text: formatItems(items, options) };
}
