import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { generateLoaderCss, type LoaderOptions } from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { colorField, rangeField, rangedNumber } from '../../../adapters/fields';

const presets: LoaderOptions['preset'][] = ['ring', 'dual-ring', 'pulse', 'bar'];
const presetLabels: Record<LoaderOptions['preset'], string> = {
  bar: 'Bar',
  'dual-ring': 'Dual',
  pulse: 'Pulse',
  ring: 'Ring',
};

const presetField: ToolField = {
  defaultValue: 'ring',
  id: 'preset',
  label: 'Preset',
  options: presets.map((value) => ({ label: presetLabels[value], value })),
  presentation: 'segmented',
  type: 'select',
};
const mainColorField = colorField('color', 'Color', '#2563eb');
const trackColorField: ToolField = {
  defaultValue: '#cbd5e1',
  id: 'trackColor',
  label: 'Track color',
  placeholder: '#cbd5e1',
  presentation: 'color',
  type: 'text',
  visibleWhen: { field: 'preset', is: ['ring', 'bar'] },
};
const loaderSizeField = rangeField({
  defaultValue: '48',
  id: 'loaderSize',
  label: 'Size',
  max: 200,
  min: 16,
  unit: 'px',
});
const thicknessField = rangeField({
  defaultValue: '4',
  id: 'thickness',
  label: 'Thickness',
  max: 24,
  min: 1,
  unit: 'px',
  visibleWhen: { field: 'preset', is: ['ring', 'dual-ring', 'bar'] },
});
const durationField = rangeField({
  defaultValue: '800',
  id: 'duration',
  label: 'Duration',
  max: 5000,
  min: 300,
  unit: 'ms',
});

const hexValue = (field: ToolField, values: Record<string, string>): string =>
  values[field.id] ?? field.defaultValue ?? '';

function runLoader(values: Record<string, string>): ToolResult {
  const preset = presets.find((entry) => entry === (values.preset ?? 'ring'));

  if (!preset) throw new ToolError(`Preset must be one of: ${presets.join(', ')}.`);

  const options: LoaderOptions = {
    color: hexValue(mainColorField, values),
    duration: rangedNumber(durationField, values),
    loaderSize: rangedNumber(loaderSizeField, values),
    preset,
    thickness: preset === 'pulse' ? 4 : rangedNumber(thicknessField, values),
    trackColor:
      preset === 'ring' || preset === 'bar' ? hexValue(trackColorField, values) : '#cbd5e1',
  };

  return cssToolResult({
    css: withToolError(() => generateLoaderCss(options)),
    fields: values,
    fileName: 'loader.css',
    kind: 'loader',
    summary:
      'Loader with markup comment, keyframes, rule and a reduced-motion override that slows it to three times the duration instead of stopping it. Keep role="status" and an accessible label in your markup. The preview stage is not exported.',
  });
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const cssLoaderGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Generate a pure-CSS loading spinner, ring, dual ring, pulse or progress bar, with live preview, pause control and a reduced-motion override.',
  fields: [
    presetField,
    mainColorField,
    trackColorField,
    loaderSizeField,
    thicknessField,
    durationField,
  ],
  id: 'css-loader-generator',
  keywords: ['loader', 'spinner', 'loading', 'progress bar', 'animation'],
  name: 'CSS Loader & Spinner Generator',
  preview: 'css-loader',
  relatedToolIds: ['css-keyframes-generator', 'css-cubic-bezier-generator'],
  run: ({ fields: values }) => runLoader(values),
  samples: [
    sample('Classic ring', {}),
    sample('Dual ring', { color: '#9333ea', preset: 'dual-ring', thickness: '6' }),
    sample('Soft pulse', { color: '#0ea5e9', duration: '1200', loaderSize: '64', preset: 'pulse' }),
    sample('Progress bar', { duration: '1400', loaderSize: '40', preset: 'bar', thickness: '6' }),
    sample('Thin large ring', { loaderSize: '120', thickness: '2' }),
    sample('Dark track', { color: '#f8fafc', preset: 'ring', trackColor: '#334155' }),
  ],
};
