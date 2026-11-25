import { ToolDefinition } from '@devtoolora/core';
import {
  apcaContrast,
  contrastRatio,
  generatePalette,
  parseColor,
  parsePaletteScheme,
  rgbToHex,
} from '@devtoolora/functions/color';
import { withToolError } from '../../../adapters/errors';
import { encodeBase64Text } from '@devtoolora/functions/encoding';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const colorPaletteTool: ToolDefinition = {
  id: 'color-palette',
  preview: 'color-palette',
  keywords: [
    'palette',
    'contrast',
    'wcag',
    'harmony',
    'complementary',
    'swatches',
    'css variables',
  ],
  name: 'Color Palette & Contrast',
  category: 'CSS & Design',
  description:
    'Keep your exact base color, compare harmonic swatches and contrast on white/black, then export a palette as JSON and CSS variables.',
  relatedToolIds: ['color-converter', 'css-box-shadow-generator'],
  resultActions: ['copy', 'scratch', 'save'],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  autoRun: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  samples: [
    { label: 'Tailwind blue', text: '#2563eb', fields: { scheme: 'complementary' } },
    { label: 'Emerald', text: '#10b981', fields: { scheme: 'analogous' } },
    { label: 'Sunset', text: '#f97316', fields: { scheme: 'triadic' } },
    { label: 'Split violet', text: 'hsl(270, 60%, 45%)', fields: { scheme: 'split' } },
    { label: 'Neutral gray', text: '#808080', fields: { scheme: 'complementary' } },
    { label: 'Black base', text: 'rgb(0, 0, 0)', fields: { scheme: 'analogous' } },
    { label: 'White base', text: '#fff', fields: { scheme: 'triadic' } },
  ],
  fields: [
    {
      id: 'scheme',
      label: 'Scheme',
      type: 'select',
      defaultValue: 'complementary',
      options: [
        { label: 'Complementary', value: 'complementary' },
        { label: 'Analogous', value: 'analogous' },
        { label: 'Triadic', value: 'triadic' },
        { label: 'Split complementary', value: 'split' },
      ],
    },
  ],
  run: ({ text, fields }) =>
    withToolError(() => {
      const base = parseColor(text.trim());
      const scheme = parsePaletteScheme(fields.scheme ?? 'complementary');
      const families = generatePalette(base, scheme);
      const roundRatio = (value: number) => Math.round(value * 100) / 100;
      const roundLc = (value: number) => Math.round(value * 10) / 10;
      const report = JSON.stringify(
        {
          base: rgbToHex(base),
          scheme,
          palette: Object.fromEntries(
            families.map((family) => [family.name, { base: family.base, shades: family.shades }]),
          ),
          apcaOnWhite: roundLc(apcaContrast(base, { r: 255, g: 255, b: 255 })),
          apcaOnBlack: roundLc(apcaContrast(base, { r: 0, g: 0, b: 0 })),
          contrastOnWhite: roundRatio(contrastRatio(base, { r: 255, g: 255, b: 255 })),
          contrastOnBlack: roundRatio(contrastRatio(base, { r: 0, g: 0, b: 0 })),
        },
        null,
        2,
      );
      const css = `:root {\n${families.flatMap((family) => Object.entries(family.shades).map(([step, color]) => `  --${family.name}-${step}: ${color};`)).join('\n')}\n}`;

      return {
        artifact: {
          base64: encodeBase64Text(report),
          fileName: 'color-palette.json',
          mimeType: 'application/json;charset=utf-8',
        },
        artifacts: [
          {
            base64: encodeBase64Text(css),
            fileName: 'color-palette.css',
            mimeType: 'text/css;charset=utf-8',
          },
        ],
        language: 'json',
        summary:
          'Base and 500 shade preserved. Opaque sRGB contrast on white/black only; this is not a full accessibility audit.',
        text: report,
      };
    }),
};
