import { FunctionError } from '../errors';
import { assertValidUnicodeText } from '../text/diacritics';

export type NormalizationForm = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
export type NormalizeChange = {
  after: string;
  afterCodePoints: string[];
  before: string;
  beforeCodePoints: string[];
};
export type NormalizeResult = {
  changedGraphemes: number;
  changes: NormalizeChange[];
  inputCodePoints: number;
  outputCodePoints: number;
  text: string;
};

const maxChanges = 100;
const maxOutputUnits = 1_000_000;

function codePointsOf(text: string): string[] {
  return Array.from(
    text,
    (character) =>
      `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
  );
}

export function normalizeUnicode(text: string, form: NormalizationForm): NormalizeResult {
  assertValidUnicodeText(text);
  if (typeof Intl.Segmenter !== 'function')
    throw new FunctionError(
      'INVALID_TEXT',
      'Grapheme segmentation is unavailable. Use a current browser or application runtime.',
    );

  const changes: NormalizeChange[] = [];
  let changedGraphemes = 0;
  let outputLength = 0;

  for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)) {
    const after = segment.normalize(form);

    if (after !== segment) {
      changedGraphemes += 1;
      if (changes.length < maxChanges)
        changes.push({
          after,
          afterCodePoints: codePointsOf(after),
          before: segment,
          beforeCodePoints: codePointsOf(segment),
        });
    }

    outputLength += after.length;
    if (outputLength > maxOutputUnits)
      throw new FunctionError(
        'INVALID_TEXT',
        'Result exceeds 1,000,000 UTF-16 units; no partial output is returned.',
      );
  }

  const output = text.normalize(form);

  return {
    changedGraphemes,
    changes,
    inputCodePoints: Array.from(text).length,
    outputCodePoints: Array.from(output).length,
    text: output,
  };
}
