import { FunctionError } from '../errors';

export type JoinLinesOptions = { dropEmpty: boolean; separator: string; trim: boolean };
export type SplitTextOptions = {
  by: 'length' | 'separator';
  dropEmpty: boolean;
  length?: number;
  separator?: string;
  trim: boolean;
};
export type JoinSplitResult = { count: number; text: string };

const maxUnits = 100_000;
const maxItems = 100_000;
const maxSeparator = 32;
const maxLength = 10_000;

function fail(message: string): never {
  throw new FunctionError('INVALID_JOIN_SPLIT', message);
}

function checkInput(text: string): void {
  if (text.length > maxUnits) fail('Input is limited to 100,000 UTF-16 units.');
}

function tidy(pieces: string[], options: { dropEmpty: boolean; trim: boolean }): string[] {
  const trimmed = options.trim ? pieces.map((piece) => piece.trim()) : pieces;
  const kept = options.dropEmpty ? trimmed.filter((piece) => piece !== '') : trimmed;

  if (kept.length > maxItems) fail('Result is limited to 100,000 items.');

  return kept;
}

function chunkByLength(text: string, length: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + length, text.length);
    const last = text.charCodeAt(end - 1);
    const next = text.charCodeAt(end);

    // Keep a surrogate pair together: the pair stays in the earlier chunk.
    if (end < text.length && last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
      end += 1;

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

export function joinLines(text: string, options: JoinLinesOptions): JoinSplitResult {
  checkInput(text);

  if (options.separator.length > maxSeparator) fail('Separator must be 0 to 32 characters.');

  const lines = tidy(text.split(/\r\n|\r|\n/), options);

  return { count: lines.length, text: lines.join(options.separator) };
}

export function splitText(text: string, options: SplitTextOptions): JoinSplitResult {
  checkInput(text);

  let pieces: string[];

  if (options.by === 'length') {
    const length = options.length;

    if (length === undefined || !Number.isInteger(length) || length < 1 || length > maxLength)
      fail('Length must be a whole number from 1 to 10,000.');

    pieces = chunkByLength(text, length);
  } else {
    const separator = options.separator ?? '';

    if (separator.length < 1 || separator.length > maxSeparator)
      fail('Separator must be 1 to 32 characters.');

    pieces = text.split(separator);
  }

  const kept = tidy(pieces, options);

  return { count: kept.length, text: kept.join('\n') };
}
