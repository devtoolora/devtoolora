import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import {
  formatCssColor,
  mixColors,
  parsePrintedCssColor,
  swatchStripSvg,
} from '@devtoolora/functions/color';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const spaces = ['srgb', 'oklab', 'oklch'] as const;

const colorAField: ToolField = {
  defaultValue: '#2563eb',
  id: 'colorA',
  label: 'Color A',
  placeholder: '#2563eb',
  presentation: 'color',
  type: 'text',
};
const colorBField: ToolField = {
  defaultValue: '#f97316',
  id: 'colorB',
  label: 'Color B',
  placeholder: '#f97316',
  presentation: 'color',
  type: 'text',
};
const weightField = rangeField({
  defaultValue: '50',
  help: 'Share of color A in the mix.',
  id: 'weight',
  label: 'Weight of A',
  max: 100,
  min: 0,
  step: 1,
  unit: '%',
});
const spaceField: ToolField = {
  defaultValue: 'oklch',
  id: 'space',
  label: 'Color space',
  options: [
    { label: 'OKLCH', value: 'oklch' },
    { label: 'OKLab', value: 'oklab' },
    { label: 'sRGB', value: 'srgb' },
  ],
  presentation: 'segmented',
  type: 'select',
};

function runMixer(values: Record<string, string>): ToolResult {
  const textA = (values.colorA ?? colorAField.defaultValue ?? '').trim();
  const textB = (values.colorB ?? colorBField.defaultValue ?? '').trim();
  const weight = rangedNumber(weightField, values);
  const space = spaces.find((entry) => entry === (values.space ?? spaceField.defaultValue));

  if (!space) throw new ToolError(`Color space must be one of: ${spaces.join(', ')}.`);

  const a = withToolError(() => parsePrintedCssColor(textA));
  const b = withToolError(() => parsePrintedCssColor(textB));
  const mixed = mixColors(a, b, weight / 100, space);
  const report = formatCssColor(mixed);
  const text = `.mix {\n  color: ${report.hex};\n  color: color-mix(in ${space}, ${textA} ${weight}%, ${textB});\n}`;
  const svg = swatchStripSvg([
    { color: formatCssColor(a).hex, detail: formatCssColor(a).hex, label: 'A' },
    { color: report.hex, detail: report.hex, label: 'Mix', marked: true },
    { color: formatCssColor(b).hex, detail: formatCssColor(b).hex, label: 'B' },
  ]);

  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: 'color-mix.css',
      mimeType: 'text/css;charset=utf-8',
    },
    artifacts: [
      {
        base64: encodeBase64Text(JSON.stringify(report, null, 2)),
        fileName: 'color-mix.json',
        mimeType: 'application/json;charset=utf-8',
      },
    ],
    language: 'css',
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(svg))}`,
    summary: `Mix resolves to ${report.hex} (${report.oklch}).`,
    text,
  };
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label, text: '' });

export const colorMixerTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Mix two CSS colors by weight in sRGB or the perceptual OKLab spaces and get the color-mix() rule with a resolved fallback.',
  fields: [colorAField, colorBField, weightField, spaceField],
  id: 'color-mixer',
  inputKind: 'none',
  keywords: ['color-mix', 'blend', 'mix colors', 'oklab', 'interpolate'],
  name: 'Color Mixer',
  relatedToolIds: ['color-scale-generator', 'color-converter'],
  run: ({ fields: values }) => runMixer(values),
  samples: [
    sample('Blue and orange', {}),
    sample('Red and blue in sRGB', { colorA: '#ff0000', colorB: '#0000ff', space: 'srgb' }),
    sample('Black and white in OKLab', {
      colorA: '#000000',
      colorB: '#ffffff',
      space: 'oklab',
    }),
    sample('Mostly green', { colorA: '#10b981', colorB: '#6366f1', weight: '80' }),
    sample('Transparent red', { colorA: 'rgb(255 0 0 / 0.4)', colorB: '#0000ff' }),
    sample('Yellow to teal', { colorA: '#facc15', colorB: '#0d9488', weight: '30' }),
  ],
};
