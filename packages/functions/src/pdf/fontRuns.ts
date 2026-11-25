import type { PDFDocument, PDFFont } from 'pdf-lib';
import { base64Decode } from '../binary';

export type CoveredFont = { characters: Set<number>; font: PDFFont };
export type FontRun = { font: PDFFont; text: string };

export function codePointLabel(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

export async function embedBundledFont(pdf: PDFDocument, base64: string): Promise<CoveredFont> {
  const font = await pdf.embedFont(base64Decode(base64), { subset: true });

  return { characters: new Set(font.getCharacterSet()), font };
}

export function splitFontRuns(
  text: string,
  fonts: CoveredFont[],
  missing: (character: string, code: number) => Error,
  spaceKeepsFont = false,
): FontRun[] {
  const output: FontRun[] = [];

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const last = output[output.length - 1];
    const font =
      spaceKeepsFont && code === 0x20 && last
        ? last.font
        : fonts.find((entry) => entry.characters.has(code))?.font;

    if (!font) throw missing(character, code);

    if (last?.font === font) last.text += character;
    else output.push({ font, text: character });
  }

  return output;
}
