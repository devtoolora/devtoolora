import { FunctionError } from '../errors';

export type ReverseMode = 'characters' | 'words' | 'lines';
export type ReverseOptions = {
  characterUnit?: 'graphemes' | 'code-points';
  scope?: 'whole' | 'per-line';
  wordSpacing?: 'preserve' | 'reverse';
};
export type ReverseResult = {
  text: string;
  unit: 'graphemes' | 'code points' | 'word blocks' | 'physical lines';
  units: number;
};
type Line = { ending: string; text: string };

function linesOf(text: string): Line[] {
  const lines: Line[] = [];

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    lines.push({ ending: match[2]!, text: match[1]! });
  }

  return lines;
}

function validateReverseInput(text: string, mode: ReverseMode): void {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Reversal input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode text without NUL or unpaired surrogates.',
    );
  if (mode !== 'characters' && mode !== 'words' && mode !== 'lines')
    throw new FunctionError('INVALID_TEXT', 'Choose Characters, Words or Lines.');
}

function validateReverseOptions(
  mode: ReverseMode,
  scope: string,
  characterUnit: string,
  wordSpacing: string,
): void {
  if (scope !== 'whole' && scope !== 'per-line')
    throw new FunctionError('INVALID_TEXT', 'Choose Whole text or Each line scope.');
  if (mode === 'characters' && characterUnit !== 'graphemes' && characterUnit !== 'code-points')
    throw new FunctionError('INVALID_TEXT', 'Choose Graphemes or Unicode code points.');
  if (mode === 'words' && wordSpacing !== 'preserve' && wordSpacing !== 'reverse')
    throw new FunctionError(
      'INVALID_TEXT',
      'Choose Keep separator slots or Reverse separators too.',
    );
  if (
    mode === 'characters' &&
    characterUnit === 'graphemes' &&
    typeof Intl.Segmenter !== 'function'
  )
    throw new FunctionError(
      'INVALID_TEXT',
      'Unicode grapheme segmentation is unavailable. Use a current browser or application runtime.',
    );
}

function reverseWords(
  part: string,
  wordSpacing: 'preserve' | 'reverse',
): { text: string; units: number } {
  const tokens = part.split(/(\s+)/);
  const words = tokens.filter((token) => token.length > 0 && !/^\s+$/.test(token));
  const units = words.length;

  if (wordSpacing === 'reverse') return { text: tokens.reverse().join(''), units };

  words.reverse();
  let wordIndex = 0;

  return {
    text: tokens
      .map((token) => (!token || /^\s+$/.test(token) ? token : words[wordIndex++]))
      .join(''),
    units,
  };
}

export function reverseTextDetailed(
  text: string,
  mode: ReverseMode = 'characters',
  options: ReverseOptions = {},
): ReverseResult {
  validateReverseInput(text, mode);

  const lines = linesOf(text);

  if (lines.length > 10_000)
    throw new FunctionError('INVALID_TEXT', 'Reversal input is limited to 10,000 physical lines.');

  if (mode === 'lines') {
    const bodies = lines.map((line) => line.text).reverse();

    return {
      text: lines.map((line, index) => bodies[index] + line.ending).join(''),
      unit: 'physical lines',
      units: lines.length,
    };
  }

  const scope = options.scope ?? 'whole';
  const characterUnit = options.characterUnit ?? 'graphemes';
  const wordSpacing = options.wordSpacing ?? 'preserve';

  validateReverseOptions(mode, scope, characterUnit, wordSpacing);

  const segmenter =
    mode === 'characters' && characterUnit === 'graphemes'
      ? new Intl.Segmenter('en', { granularity: 'grapheme' })
      : undefined;
  let units = 0;

  function reversePart(part: string): string {
    if (mode === 'characters') {
      const characters = segmenter
        ? Array.from(segmenter.segment(part), (segment) => segment.segment)
        : Array.from(part);

      units += characters.length;

      return characters.reverse().join('');
    }

    const reversed = reverseWords(part, wordSpacing);

    units += reversed.units;

    return reversed.text;
  }

  const reversed =
    scope === 'whole'
      ? reversePart(text)
      : lines.map((line) => reversePart(line.text) + line.ending).join('');

  return {
    text: reversed,
    unit: reversedUnit(mode, characterUnit),
    units,
  };
}

function reversedUnit(
  mode: ReverseMode,
  characterUnit: 'graphemes' | 'code-points',
): 'graphemes' | 'code points' | 'word blocks' {
  if (mode === 'words') return 'word blocks';

  return characterUnit === 'graphemes' ? 'graphemes' : 'code points';
}

export function reverseText(
  text: string,
  mode: ReverseMode = 'characters',
  options: ReverseOptions = {},
): string {
  return reverseTextDetailed(text, mode, options).text;
}
