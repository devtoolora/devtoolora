import { FunctionError } from '../errors';

export type StripDiacriticsOptions = { scope?: 'latin' | 'diacritics' | 'marks' };
export type StripDiacriticsResult = {
  changedGraphemes: number;
  inputCodePoints: number;
  nonAsciiCodePoints: number;
  outputCodePoints: number;
  removedMarks: number;
  text: string;
};

export function assertValidUnicodeText(text: string): void {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode without NUL or unpaired surrogates.',
    );
}

function validateDiacriticsInput(text: string, scope: string): void {
  assertValidUnicodeText(text);
  if (scope !== 'latin' && scope !== 'diacritics' && scope !== 'marks')
    throw new FunctionError(
      'INVALID_TEXT',
      'Choose Latin accents, Combining diacritics or All combining marks.',
    );
  if (typeof Intl.Segmenter !== 'function')
    throw new FunctionError(
      'INVALID_TEXT',
      'Grapheme segmentation is unavailable. Use a current browser or application runtime.',
    );
}

function stripGrapheme(
  segment: string,
  scope: 'latin' | 'diacritics' | 'marks',
): { removed: number; text: string } {
  const kept: string[] = [];
  let latinBase = false;
  let removed = 0;

  for (const character of segment.normalize('NFD')) {
    const mark = /\p{Mark}/u.test(character);

    if (!mark)
      latinBase = /\p{Letter}/u.test(character) && /\p{Script_Extensions=Latin}/u.test(character);
    if (
      mark &&
      (scope === 'marks' ||
        (/\p{Diacritic}/u.test(character) && (scope === 'diacritics' || latinBase)))
    )
      removed += 1;
    else kept.push(character);
  }

  return { removed, text: removed > 0 ? kept.join('').normalize('NFC') : segment };
}

export function stripDiacriticsDetailed(
  text: string,
  options: StripDiacriticsOptions = {},
): StripDiacriticsResult {
  const scope = options.scope ?? 'latin';

  validateDiacriticsInput(text, scope);

  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const chunks: string[] = [];
  let changedGraphemes = 0;
  let removedMarks = 0;
  let outputLength = 0;

  for (const { segment } of segmenter.segment(text)) {
    const { removed, text: changed } = stripGrapheme(segment, scope);

    if (changed !== segment) changedGraphemes += 1;

    removedMarks += removed;
    outputLength += changed.length;
    if (outputLength > 1_000_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'Result exceeds 1,000,000 UTF-16 units; no partial output is returned.',
      );

    chunks.push(changed);
  }

  const resultText = chunks.join('');
  const outputPoints = Array.from(resultText);

  return {
    changedGraphemes,
    inputCodePoints: Array.from(text).length,
    nonAsciiCodePoints: outputPoints.filter((character) => (character.codePointAt(0) ?? 0) > 0x7f)
      .length,
    outputCodePoints: outputPoints.length,
    removedMarks,
    text: resultText,
  };
}
