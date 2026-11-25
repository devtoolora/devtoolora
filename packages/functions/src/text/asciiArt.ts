import figlet from 'figlet';
import { FunctionError } from '../errors';

export type AsciiArtOptions = {
  horizontalLayout?: 'default' | 'fitted' | 'full';
  normalization?: 'exact' | 'strip-accents';
  verticalLayout?: 'default' | 'fitted' | 'full';
};

export type AsciiArtResult = {
  columns: number;
  rows: number;
  text: string;
};

// Letters whose stroke or bar is part of the code point, so NFD leaves no combining mark to remove.
const strokeLetters: Record<string, string> = {
  Đ: 'D',
  đ: 'd',
  Ħ: 'H',
  ħ: 'h',
  Ł: 'L',
  ł: 'l',
  Ø: 'O',
  ø: 'o',
  Ŧ: 'T',
  ŧ: 't',
};

function validateAsciiText(text: string, maxLength: number): void {
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 100)
    throw new FunctionError(
      'INVALID_TEXT',
      'ASCII input limit must be a whole number from 1 to 100.',
    );
  if (!text.trim())
    throw new FunctionError('INVALID_TEXT', 'Text is required to generate ASCII art.');
  if (Array.from(text).length > maxLength)
    throw new FunctionError(
      'INVALID_TEXT',
      `ASCII text is limited to ${maxLength} characters (Unicode code points, including line breaks).`,
    );
  if (/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode text without tabs, control characters or unpaired surrogates.',
    );
}

function loadFigletFont(font: string, fontData: string): void {
  try {
    if (!figlet.figFonts[font]) figlet.parseFont(font, fontData);
  } catch (error) {
    throw new FunctionError(
      'FIGLET_FAILED',
      `Could not load FIGlet font: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertFontCoversText(font: string, source: string): void {
  const parsedFont = figlet.figFonts[font];

  if (!parsedFont) throw new FunctionError('FIGLET_FAILED', `Could not load FIGlet font: ${font}`);

  const missing = Array.from(
    new Set(
      Array.from(source).filter((character) => {
        if (character === '\n' || character === ' ') return false;

        const codePoint = character.codePointAt(0) ?? 0;
        const glyph = parsedFont[codePoint];

        return (
          codePoint > 0xffff ||
          !Array.isArray(glyph) ||
          !glyph
            .join('')
            .replaceAll(parsedFont.options.hardBlank ?? '\0', ' ')
            .trim()
        );
      }),
    ),
  );

  if (!missing.length) return;

  const labels = missing
    .slice(0, 5)
    .map(
      (character) =>
        `${JSON.stringify(character)} (U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')})`,
    )
    .join(', ');

  throw new FunctionError(
    'INVALID_TEXT',
    `Font ${font} cannot render ${labels}${missing.length > 5 ? ' and more' : ''}. Choose another font or explicitly strip accents; unsupported characters are not dropped.`,
  );
}

export function renderAsciiArt(
  text: string,
  font: string,
  fontData: string,
  options: AsciiArtOptions = {},
  maxLength: number = 100,
): AsciiArtResult {
  validateAsciiText(text, maxLength);

  const horizontalLayout = options.horizontalLayout ?? 'default';
  const verticalLayout = options.verticalLayout ?? 'default';
  const normalization = options.normalization ?? 'exact';

  if (
    !['default', 'fitted', 'full'].includes(horizontalLayout) ||
    !['default', 'fitted', 'full'].includes(verticalLayout)
  )
    throw new FunctionError('INVALID_TEXT', 'Choose Default, Fitted or Full spacing.');
  if (normalization !== 'exact' && normalization !== 'strip-accents')
    throw new FunctionError('INVALID_TEXT', 'Choose Exact text or Strip accents.');

  let source = text.replace(/\r\n?/g, '\n');

  if (normalization === 'strip-accents')
    source = source
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[ĐđĦħŁłØøŦŧ]/g, (letter) => strokeLetters[letter] ?? letter);

  loadFigletFont(font, fontData);
  assertFontCoversText(font, source);

  let output: string;

  try {
    output = figlet.textSync(source, { font, horizontalLayout, verticalLayout });
  } catch (error) {
    throw new FunctionError(
      'FIGLET_FAILED',
      `Could not generate ASCII art: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (output.length > 100_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'ASCII output exceeds 100,000 UTF-16 units. Use shorter text or a smaller font.',
    );
  if (!output.trim())
    throw new FunctionError(
      'INVALID_TEXT',
      'The selected font produced no visible glyphs. Choose another font.',
    );

  const lines = output.split('\n');

  return {
    columns: Math.max(...lines.map((line) => Array.from(line).length)),
    rows: lines.length,
    text: output,
  };
}

export function generateFigletText(
  text: string,
  font: string,
  fontData: string,
  maxLength: number = 100,
): string {
  return renderAsciiArt(text, font, fontData, {}, maxLength).text;
}
