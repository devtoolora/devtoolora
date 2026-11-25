import { FunctionError } from '../errors/FunctionError';

export type FrequencyOptions = {
  caseSensitive: boolean;
  ignoreStopWords: boolean;
  limit: number;
  minLength: number;
  unit: 'characters' | 'words';
};

export type FrequencyRow = { count: number; percent: number; value: string };

const maxUnits = 1_000_000;
const stopWords = new Set(
  (
    'a about above after again all also am an and any are as at be because been before being below between both but by ' +
    'can could did do does doing down during each few for from further had has have having he her here hers him his how ' +
    'i if in into is it its me more most my no nor not of off on once only or other our out over own same she should so ' +
    'some such than that the their them then there these they this those through to too under until up very was we were ' +
    'what when where which while who whom why will with would you your'
  ).split(' '),
);
// Combining marks belong to their word: Devanagari, Thai and decomposed Latin depend on them.
const wordPattern = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['\u2019][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;

function* tokens(text: string, unit: FrequencyOptions['unit']): Generator<string> {
  if (unit === 'words') {
    for (const match of text.matchAll(wordPattern)) yield match[0];

    return;
  }

  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
    text,
  )) {
    if (!/^\s+$/u.test(segment)) yield segment;
  }
}

export function countFrequency(
  text: string,
  options: FrequencyOptions,
): { distinct: number; rows: FrequencyRow[]; total: number } {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)
    throw new FunctionError('INVALID_INPUT', 'Top entries must be a whole number from 1 to 1,000.');
  if (text.length > maxUnits)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');

  const counts = new Map<string, number>();
  let total = 0;

  for (const token of tokens(text.normalize('NFC'), options.unit)) {
    const value = options.caseSensitive ? token : token.toLowerCase();

    if (options.unit === 'words') {
      if (Array.from(value).length < options.minLength) continue;
      if (options.ignoreStopWords && stopWords.has(value.toLowerCase())) continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
    total += 1;
  }

  const rows = Array.from(counts, ([value, count]) => ({
    count,
    percent: Math.round((count / total) * 1000) / 10,
    value,
  }));

  rows.sort((a, b) => b.count - a.count);

  return { distinct: counts.size, rows: rows.slice(0, options.limit), total };
}
