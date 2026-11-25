import { FunctionError } from '../errors/FunctionError';

export type ReadabilityReport = {
  complexWords: number;
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  gunningFog: number;
  sentences: number;
  syllables: number;
  words: number;
};

const maxChars = 1_000_000;
const round = (value: number): number => Math.round(value * 10) / 10;

export function countSyllables(word: string): number {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');

  if (letters.length <= 3) return 1;

  const stem = letters.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');

  return Math.max(1, stem.match(/[aeiouy]{1,2}/g)?.length ?? 0);
}

export function readability(text: string): ReadabilityReport {
  if (text.length > maxChars)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');

  const found = text.match(/[A-Za-z]+(?:['\u2019][A-Za-z]+)*/g) ?? [];

  if (found.length === 0)
    throw new FunctionError('INVALID_INPUT', 'Enter at least one English word.');

  const sentences = Math.max(1, text.match(/[.!?]+(?=\s|$)/g)?.length ?? 0);
  const counts = found.map(countSyllables);
  const words = found.length;
  const syllables = counts.reduce((sum, count) => sum + count, 0);
  const complexWords = counts.filter((count) => count >= 3).length;
  const perSentence = words / sentences;
  const perWord = syllables / words;

  return {
    complexWords,
    fleschKincaidGrade: round(0.39 * perSentence + 11.8 * perWord - 15.59),
    fleschReadingEase: round(206.835 - 1.015 * perSentence - 84.6 * perWord),
    gunningFog: round(0.4 * (perSentence + (100 * complexWords) / words)),
    sentences,
    syllables,
    words,
  };
}
