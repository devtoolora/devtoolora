import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  loadFigletFont,
  renderAsciiArt,
  type AsciiArtOptions,
  type AsciiArtResult,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import asciiFontNames from '../../../figletFontNames.json';

const fontNames = new Map(asciiFontNames.map((font) => [font.toLowerCase(), font]));

export const asciiTextFontOptions: Array<{ label: string; value: string }> = asciiFontNames.map(
  (font) => ({ label: font, value: font }),
);

async function generate(
  text: string,
  font: string,
  options: AsciiArtOptions,
): Promise<AsciiArtResult> {
  const canonicalFont = fontNames.get(font.trim().toLowerCase());

  if (!canonicalFont) throw new ToolError(`Unknown FIGlet font: ${font}.`);

  const fontData = await loadFigletFont(canonicalFont);

  return withToolError(() => renderAsciiArt(text, canonicalFont, fontData, options));
}

export async function generateAsciiText(text: string, font: string = 'Standard'): Promise<string> {
  return (await generate(text, font, {})).text;
}

export const asciiTextGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Create FIGlet text banners with searchable fonts, adjustable spacing and an exact, unwrapped TXT export.',
  fields: [
    {
      defaultValue: 'Standard',
      help: 'Search the bundled font list. Only the chosen font module is loaded.',
      id: 'font',
      label: 'Font',
      options: asciiTextFontOptions,
      searchable: true,
      type: 'select',
    },
    {
      defaultValue: 'default',
      id: 'horizontalLayout',
      label: 'Horizontal spacing',
      options: [
        { label: 'Font default', value: 'default' },
        { label: 'Fitted', value: 'fitted' },
        { label: 'Full spacing', value: 'full' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'default',
      help: 'Useful for multi-line input. Font default may smush adjacent rows.',
      id: 'verticalLayout',
      label: 'Vertical spacing',
      options: [
        { label: 'Font default', value: 'default' },
        { label: 'Fitted', value: 'fitted' },
        { label: 'Full spacing', value: 'full' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'exact',
      help: 'Strip accents uses NFD to remove combining marks and folds stroke letters such as Ł and đ to L and d. It is not a full transliteration.',
      id: 'normalization',
      label: 'Input normalization',
      options: [
        { label: 'Exact text', value: 'exact' },
        { label: 'Strip accents', value: 'strip-accents' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'ascii-text-generator',
  inputKind: 'text',
  keywords: ['ascii', 'figlet', 'banner', 'terminal', 'font', 'text-art'],
  name: 'ASCII Text Generator',
  outputKind: 'text',
  relatedToolIds: ['text-statistics', 'strip-diacritics', 'image-tools'],
  resultActions: ['copy', 'insert', 'scratch', 'save'],
  run: async ({ fields, text }) => {
    function layout(value: string | undefined): NonNullable<AsciiArtOptions['horizontalLayout']> {
      if (value === undefined || value === 'default') return 'default';
      if (value === 'full' || value === 'fitted') return value;

      throw new ToolError('Choose Font default, Fitted or Full spacing.');
    }

    const normalization = fields.normalization ?? 'exact';

    if (normalization !== 'exact' && normalization !== 'strip-accents')
      throw new ToolError('Choose Exact text or Strip accents.');

    const result = await generate(text, fields.font ?? 'Standard', {
      horizontalLayout: layout(fields.horizontalLayout),
      normalization,
      verticalLayout: layout(fields.verticalLayout),
    });

    return {
      artifact: {
        base64: encodeBase64Text(result.text),
        fileName: 'ascii-art.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      asciiArt: { columns: result.columns, rows: result.rows },
      language: 'plaintext',
      summary: `${result.rows} rows · ${result.columns} maximum code points per row · ${fontNames.get((fields.font ?? 'Standard').trim().toLowerCase())} · ${normalization === 'exact' ? 'exact input characters' : 'accents explicitly stripped'}.`,
      text: result.text,
    };
  },
  samples: [
    {
      fields: {
        font: 'Standard',
        horizontalLayout: 'default',
        normalization: 'exact',
        verticalLayout: 'default',
      },
      label: 'Hello',
      text: 'Hello',
    },
    {
      fields: {
        font: 'Big',
        horizontalLayout: 'default',
        normalization: 'exact',
        verticalLayout: 'default',
      },
      label: 'Dev Toolora',
      text: 'Dev Toolora',
    },
    {
      fields: {
        font: 'Standard',
        horizontalLayout: 'full',
        normalization: 'exact',
        verticalLayout: 'full',
      },
      label: 'Stacked labels',
      text: 'Hi\nBye',
    },
    {
      fields: {
        font: 'Small',
        horizontalLayout: 'fitted',
        normalization: 'exact',
        verticalLayout: 'default',
      },
      label: 'Compact heading',
      text: 'Local',
    },
    {
      fields: {
        font: 'Big',
        horizontalLayout: 'default',
        normalization: 'strip-accents',
        verticalLayout: 'default',
      },
      label: 'Czech accents explicitly removed',
      text: 'Příliš',
    },
    {
      fields: {
        font: 'ANSI Shadow',
        horizontalLayout: 'default',
        normalization: 'exact',
        verticalLayout: 'default',
      },
      label: 'Unicode block font',
      text: 'DEV',
    },
  ],
  supportsSelection: true,
  freshResults: true,
};
