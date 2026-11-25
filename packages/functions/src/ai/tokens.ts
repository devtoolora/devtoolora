import { FunctionError } from '../errors';
import { aiLimits } from './limits';

export type TokenEstimate = {
  contextFit: Array<{ percent: number; tokens: number }>;
  counts: {
    codePoints: number;
    lines: number;
    utf16Units: number;
    utf8Bytes: number;
    words: number;
  };
  estimate: number;
  high: number;
  low: number;
  margin: 0.2 | 0.4 | 0.5;
};

type Margin = TokenEstimate['margin'];
type TokenClass = 'cjk' | 'emoji' | 'latin' | 'other' | 'punct' | 'script' | 'space';

const contextSizes = [8_192, 32_768, 128_000, 200_000, 1_000_000];
// Weights are in quarter tokens so the scan sums integers.
const quarters = { cjk: 4, emoji: 8, latin: 1, other: 2, punct: 2, script: 2, space: 0 } as const;

const emojiPattern = /^\p{Extended_Pictographic}$/u;
const cjkPattern = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;
const latinPattern = /^[\p{Script=Latin}0-9]$/u;
const asciiPunctPattern = /^[!-/:-@[-`{-~]$/;
const letterPattern = /^\p{L}$/u;
const zeroPattern = /^[\p{M}\p{Cf}]$/u;
const spacePattern = /\s/;
const lineBreak = /\r\n|\r|\n/;

function classify(char: string): TokenClass | 'zero' {
  if (emojiPattern.test(char)) return 'emoji';
  if (cjkPattern.test(char)) return 'cjk';
  if (latinPattern.test(char)) return 'latin';
  if (asciiPunctPattern.test(char)) return 'punct';
  if (letterPattern.test(char)) return 'script';
  if (zeroPattern.test(char)) return 'zero';

  return 'other';
}

function whitespaceEnd(text: string, start: number): number {
  let end = start;

  while (end < text.length && spacePattern.test(text.charAt(end))) end += 1;

  return end;
}

function whitespaceQuarters(run: string): number {
  const pieces = run.split(lineBreak);

  return (pieces.length - 1 + pieces.filter((piece) => piece.length > 0).length) * 4;
}

function pickMargin(counts: Record<TokenClass, number>, codePoints: number): Margin {
  if (counts.punct * 100 > codePoints * 15) return 0.4;

  const { space: _space, ...content } = counts;
  const largest = Math.max(...Object.values(content));

  return counts.latin === largest ? 0.2 : 0.5;
}

function scan(text: string) {
  const counts: Record<TokenClass, number> = {
    cjk: 0,
    emoji: 0,
    latin: 0,
    other: 0,
    punct: 0,
    script: 0,
    space: 0,
  };
  let codePoints = 0;
  let sum = 0;
  let index = 0;

  while (index < text.length) {
    const point = text.codePointAt(index) ?? 0;
    const char = String.fromCodePoint(point);

    if (spacePattern.test(char)) {
      const end = whitespaceEnd(text, index);
      const run = text.slice(index, end);
      const single = run === ' ';

      codePoints += run.length;
      counts[single ? 'latin' : 'space'] += run.length;
      sum += single ? quarters.latin : whitespaceQuarters(run);
      index = end;

      continue;
    }

    const kind = classify(char);

    codePoints += 1;
    index += char.length;
    if (kind === 'zero') continue;

    counts[kind] += 1;
    sum += quarters[kind];
  }

  return { codePoints, counts, sum };
}

function countWords(text: string): number {
  let words = 0;

  for (const part of new Intl.Segmenter('en', { granularity: 'word' }).segment(text)) {
    if (part.isWordLike) words += 1;
  }

  return words;
}

function countLines(text: string): number {
  if (text === '') return 0;

  const lines = text.split(lineBreak);

  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

export function analyzeTokens(text: string): TokenEstimate {
  if (text.length > aiLimits.textUnits) {
    throw new FunctionError(
      'INVALID_AI_INPUT',
      'Text must be at most 1,000,000 characters (UTF-16 units).',
    );
  }

  const { codePoints, counts, sum } = scan(text);
  const estimate = Math.ceil(sum / 4);
  const margin = pickMargin(counts, codePoints);
  const percent = Math.round(margin * 100);
  const high = Math.ceil((estimate * (100 + percent)) / 100);

  return {
    contextFit: contextSizes.map((tokens) => ({
      percent: Math.round((high / tokens) * 1000) / 10,
      tokens,
    })),
    counts: {
      codePoints,
      lines: countLines(text),
      utf16Units: text.length,
      utf8Bytes: new TextEncoder().encode(text).length,
      words: countWords(text),
    },
    estimate,
    high,
    low: Math.floor((estimate * (100 - percent)) / 100),
    margin,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(scan(text).sum / 4);
}
