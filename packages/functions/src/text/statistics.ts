import { FunctionError } from '../errors';

export type TextStatisticsOptions = {
  locale?: 'en' | 'cs' | 'zh' | 'ja' | 'th';
  wordsPerMinute?: number;
};

export type TextStatistics = {
  bytes: number;
  characters: number;
  digits: number;
  graphemes: number;
  letters: number;
  lines: number;
  nonEmptyLines: number;
  readingTimeMinutes: number;
  readingTimeSeconds: number;
  symbols: number;
  utf16Units: number;
  whitespace: number;
  words: number;
  wordsPerMinute: number;
};

export function textStatistics(text: string, options: TextStatisticsOptions = {}): TextStatistics {
  const locale = options.locale ?? 'en';
  const wordsPerMinute = options.wordsPerMinute ?? 200;

  if (!['en', 'cs', 'zh', 'ja', 'th'].includes(locale))
    throw new FunctionError('INVALID_TEXT', 'Choose a supported word language.');
  if (!Number.isInteger(wordsPerMinute) || wordsPerMinute < 50 || wordsPerMinute > 1000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Reading speed must be an integer between 50 and 1,000 words per minute.',
    );
  if (text.length > 100_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Text statistics supports at most 100,000 UTF-16 input units.',
    );
  if (/[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Text contains an unpaired Unicode surrogate. Provide valid Unicode text.',
    );
  if (typeof Intl.Segmenter !== 'function')
    throw new FunctionError(
      'INVALID_TEXT',
      'Unicode text segmentation is unavailable. Use a current browser or application runtime.',
    );

  let graphemes = 0;
  let words = 0;

  for (const segment of new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)) {
    if (segment.segment.length) graphemes += 1;
  }

  for (const segment of new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)) {
    if (segment.isWordLike) words += 1;
  }

  const lines = text.length ? text.split(/\r\n|[\n\r\u2028\u2029]/u) : [];

  return {
    bytes: new TextEncoder().encode(text).length,
    characters: [...text].length,
    digits: (text.match(/\p{Nd}/gu) ?? []).length,
    graphemes,
    letters: (text.match(/\p{L}/gu) ?? []).length,
    lines: lines.length,
    nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
    readingTimeMinutes: Math.ceil(words / wordsPerMinute),
    readingTimeSeconds: Math.ceil((words * 60) / wordsPerMinute),
    symbols: (text.match(/[\p{P}\p{S}]/gu) ?? []).length,
    utf16Units: text.length,
    whitespace: (text.match(/\s/gu) ?? []).length,
    words,
    wordsPerMinute,
  };
}
