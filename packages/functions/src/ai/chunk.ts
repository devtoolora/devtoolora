import { FunctionError } from '../errors';
import { aiLimits } from './limits';
import { estimateTokens } from './tokens';

export type ChunkOptions = {
  boundary: 'none' | 'paragraph' | 'sentence' | 'word';
  overlap: number;
  size: number;
  unit: 'characters' | 'tokens';
};

export type TextChunk = {
  chars: number;
  end: number;
  estimatedTokens: number;
  index: number;
  start: number;
  text: string;
};

const { chunks: maxChunks, maxSize, minSize } = aiLimits.chunker;
const format = new Intl.NumberFormat('en-US');

const fail = (message: string): never => {
  throw new FunctionError('INVALID_AI_INPUT', message);
};

function matchEnds(text: string, pattern: RegExp): number[] {
  return Array.from(text.matchAll(pattern), (match) => match.index + match[0].length);
}

function boundaryLists(text: string, boundary: ChunkOptions['boundary']): number[][] {
  const lists: number[][] = [];

  if (boundary === 'paragraph') lists.push(matchEnds(text, /\n[^\S\n]*\n\s*/g));

  if (boundary === 'paragraph' || boundary === 'sentence') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });

    lists.push(Array.from(segmenter.segment(text), ({ index, segment }) => index + segment.length));
  }

  if (boundary !== 'none') lists.push(matchEnds(text, /\s+/g));

  return lists;
}

const isHigh = (text: string, index: number) => {
  const code = text.charCodeAt(index);

  return code >= 0xd800 && code <= 0xdbff;
};

function pickEnd(
  text: string,
  [start, limit, previousEnd]: [number, number, number],
  lists: number[][],
  at: number[],
) {
  const half = Math.max(start + Math.ceil((limit - start) / 2), previousEnd + 1);

  for (const [i, list] of lists.entries()) {
    let cursor = at[i] ?? 0;

    while (cursor < list.length && (list[cursor] ?? 0) <= limit) cursor += 1;
    at[i] = cursor;

    const found = list[cursor - 1] ?? 0;

    if (found >= half && found > start) return found;
  }

  const hard = isHigh(text, limit - 1) && limit < text.length ? limit - 1 : limit;

  return hard > start ? hard : Math.min(start + 2, text.length);
}

function windowOf(text: string, { overlap, size, unit }: ChunkOptions) {
  if (unit === 'characters') return { overlap, window: size };

  // Zero-weight text has no estimate; treat one token as one character.
  const scale = text.length / (estimateTokens(text) || text.length);

  return {
    overlap: Math.floor(overlap * scale),
    window: Math.max(1, Math.floor(size * scale)),
  };
}

export function chunkText(text: string, options: ChunkOptions): TextChunk[] {
  const { boundary, overlap, size } = options;

  if (!Number.isInteger(size) || size < minSize || size > maxSize)
    fail(`Size must be a whole number in ${minSize}-${format.format(maxSize)}.`);

  if (!Number.isInteger(overlap) || overlap < 0 || overlap > Math.floor(size / 2))
    fail(`Overlap must be at most ${Math.floor(size / 2)} for size ${size}.`);

  if (text.length > aiLimits.textUnits)
    fail('Text must be at most 1,000,000 characters (UTF-16 units).');

  if (text === '') return [];

  const plan = windowOf(text, options);
  const lists = boundaryLists(text, boundary);
  const at: number[] = [];
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const limit = Math.min(start + plan.window, text.length);
    const previousEnd = chunks.at(-1)?.end ?? 0;
    const end =
      limit === text.length ? limit : pickEnd(text, [start, limit, previousEnd], lists, at);
    const slice = text.slice(start, end);

    if (chunks.length === maxChunks)
      fail(`Too many chunks: at most ${format.format(maxChunks)} are allowed.`);

    chunks.push({
      chars: slice.length,
      end,
      estimatedTokens: estimateTokens(slice),
      index: chunks.length,
      start,
      text: slice,
    });

    if (end >= text.length) break;

    let next = Math.max(end - plan.overlap, start + 1);

    if (isHigh(text, next - 1)) next += 1;

    start = next;
  }

  return chunks;
}
