import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import {
  generateColorScale,
  parseCssColor,
  swatchStripSvg,
  type ColorScaleEntry,
} from '@devtoolora/functions/color';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { cssGeneratorDefaults } from '../shared';

type ScaleFormat = 'css' | 'json' | 'tailwind-v3' | 'tailwind-v4';

const formats: ScaleFormat[] = ['css', 'tailwind-v4', 'tailwind-v3', 'json'];
const colorFormats = ['hex', 'oklch'] as const;
const formatMessage = `Format must be one of: ${formats.join(', ')}.`;
const colorFormatMessage = `Color format must be one of: ${colorFormats.join(', ')}.`;
const fileNames: Record<ScaleFormat, string> = {
  css: 'color-scale.css',
  json: 'color-scale.json',
  'tailwind-v3': 'tailwind.config.js',
  'tailwind-v4': 'tailwind-theme.css',
};
const languages: Record<ScaleFormat, string> = {
  css: 'css',
  json: 'json',
  'tailwind-v3': 'javascript',
  'tailwind-v4': 'css',
};

const nameField: ToolField = {
  defaultValue: 'brand',
  help: 'Lowercase letters, digits and hyphens, starting with a letter (up to 32 characters).',
  id: 'name',
  label: 'Name',
  placeholder: 'brand',
  type: 'text',
};
const formatField: ToolField = {
  defaultValue: 'css',
  id: 'format',
  label: 'Format',
  options: [
    { label: 'CSS variables', value: 'css' },
    { label: 'Tailwind v4 @theme', value: 'tailwind-v4' },
    { label: 'Tailwind v3 config', value: 'tailwind-v3' },
    { label: 'JSON', value: 'json' },
  ],
  type: 'select',
};
const colorFormatField: ToolField = {
  defaultValue: 'hex',
  id: 'colorFormat',
  label: 'Color format',
  options: [
    { label: 'Hex', value: 'hex' },
    { label: 'OKLCH', value: 'oklch' },
  ],
  presentation: 'segmented',
  type: 'select',
};

function formatScale(
  format: ScaleFormat,
  name: string,
  rows: Array<[ColorScaleEntry['step'], string]>,
): string {
  const lines = (indent: string, line: (step: number, value: string) => string) =>
    rows.map(([step, value]) => `${indent}${line(step, value)}`).join('\n');

  if (format === 'css') return `:root {\n${lines('  ', (s, v) => `--${name}-${s}: ${v};`)}\n}`;
  if (format === 'tailwind-v4')
    return `@theme {\n${lines('  ', (s, v) => `--color-${name}-${s}: ${v};`)}\n}`;
  if (format === 'json') return JSON.stringify(Object.fromEntries(rows), null, 2);

  const key = /^[a-z][a-z0-9]*$/.test(name) ? name : `'${name}'`;

  return `// tailwind.config.js, inside theme.extend\ncolors: {\n  ${key}: {\n${lines('    ', (s, v) => `${s}: '${v}',`)}\n  },\n},`;
}

function scaleSummary({ anchor, steps }: ReturnType<typeof generateColorScale>): string {
  const anchorEntry = steps.find((entry) => entry.step === anchor);

  return anchorEntry?.gamutMapped
    ? `Your color is outside sRGB, so step ${anchor} holds it mapped to ${anchorEntry.hex}. Every step builds on that value and one shared lightness ladder.`
    : `Your color sits at step ${anchor} and keeps its exact value. Other steps use one shared lightness ladder.`;
}

function runScale(text: string, values: Record<string, string>): ToolResult {
  const name = values.name ?? nameField.defaultValue ?? '';

  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name))
    throw new ToolError(
      'Name must start with a lowercase letter and use only lowercase letters, digits and hyphens (up to 32 characters).',
    );

  const format = choiceField(values.format, 'css', formats, formatMessage);
  const colorFormat = choiceField(values.colorFormat, 'hex', colorFormats, colorFormatMessage);
  const scale = withToolError(() => generateColorScale(parseCssColor(text)));
  const output = formatScale(
    format,
    name,
    // An achromatic step prints hue 0, not the surprising (valid) `none`.
    scale.steps.map((entry) => [entry.step, entry[colorFormat].replace(/ none\)$/, ' 0)')]),
  );
  const report = JSON.stringify(
    {
      anchor: scale.anchor,
      steps: scale.steps.map(({ gamutMapped, hex, oklch, step }) => ({
        anchor: step === scale.anchor,
        gamutMapped,
        hex,
        oklch,
        step,
      })),
    },
    null,
    2,
  );
  const svg = swatchStripSvg(
    scale.steps.map((entry) => ({
      color: entry.hex,
      detail: entry.hex,
      label: String(entry.step),
      marked: entry.step === scale.anchor,
    })),
  );

  return {
    artifact: {
      base64: encodeBase64Text(output),
      fileName: fileNames[format],
      mimeType: 'text/plain;charset=utf-8',
    },
    artifacts: [
      {
        base64: encodeBase64Text(report),
        fileName: 'color-scale-report.json',
        mimeType: 'application/json;charset=utf-8',
      },
    ],
    language: languages[format],
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(svg))}`,
    summary: scaleSummary(scale),
    text: output,
  };
}

const sample = (label: string, text: string, fields: Record<string, string> = {}) => ({
  fields,
  label,
  text,
});

export const colorScaleTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Generate a Tailwind-style 50 to 950 shade scale from one color, as CSS variables, Tailwind v3 or v4 config or JSON.',
  fields: [nameField, formatField, colorFormatField],
  id: 'color-scale-generator',
  inputKind: 'text',
  inputPresentation: {
    label: 'Color',
    placeholder: '#2563eb, rgb(37 99 235) or oklch(55% 0.2 263)',
  },
  keywords: ['tailwind', 'shades', 'tints', 'color scale', '50-950', 'design tokens'],
  name: 'Color Scale Generator',
  relatedToolIds: ['color-palette', 'color-converter'],
  run: ({ fields: values, text }) => runScale(text, values),
  samples: [
    sample('Tailwind blue 600', '#2563eb', { format: 'tailwind-v4' }),
    sample('Bright blue', 'rgb(59 130 246)'),
    sample('Emerald in OKLCH', '#10b981', { colorFormat: 'oklch' }),
    sample('Pale yellow', 'hsl(48 97% 77%)', { format: 'tailwind-v3', name: 'sand' }),
    sample('Deep indigo', 'oklch(26% 0.09 281)', { format: 'json', name: 'indigo' }),
    sample('White', 'white', { name: 'snow' }),
  ],
};
