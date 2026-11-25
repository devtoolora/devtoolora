import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import {
  easingPresets,
  generateEasingCss,
  resolveEasing,
  type BezierPoints,
} from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const presetLabels: Record<string, string> = {
  ease: 'ease (CSS keyword)',
  'ease-in': 'ease-in (CSS keyword)',
  'ease-in-out': 'ease-in-out (CSS keyword)',
  'ease-out': 'ease-out (CSS keyword)',
  linear: 'linear (CSS keyword)',
};

const readableLabel = (preset: string): string =>
  presetLabels[preset] ??
  preset.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^e/, 'E');

const presetField: ToolField = {
  defaultValue: 'custom',
  id: 'preset',
  label: 'Preset',
  options: [
    { label: 'Custom curve', value: 'custom' },
    ...Object.keys(easingPresets).map((value) => ({ label: readableLabel(value), value })),
  ],
  type: 'select',
};

const point = (id: string, label: string, min: number, defaultValue: string): ToolField =>
  rangeField({ defaultValue, id, label, max: min === 0 ? 1 : 2, min, step: 0.01 });

const pointFields: ToolField[] = [
  point('x1', 'X1 (time)', 0, '0.68'),
  point('y1', 'Y1 (progress)', -1, '-0.6'),
  point('x2', 'X2 (time)', 0, '0.32'),
  point('y2', 'Y2 (progress)', -1, '1.6'),
];

const durationField = rangeField({
  defaultValue: '300',
  id: 'duration',
  label: 'Duration',
  max: 10000,
  min: 100,
  unit: 'ms',
});

function curveSummary(preset: string, keyword: string | undefined): string {
  if (keyword) return `Matches the CSS keyword ${keyword}, printed in its numeric form.`;

  return preset === 'custom'
    ? 'Custom cubic-bezier curve.'
    : `${readableLabel(preset)} curve from easings.net.`;
}

const summary = (preset: string, keyword: string | undefined): string =>
  `${curveSummary(preset, keyword)} Y values below 0 or above 1 overshoot the start or end. The preview track and comparison block are not exported.`;

function runEasing(values: Record<string, string>): ToolResult {
  const preset = values.preset ?? 'custom';
  const custom: BezierPoints =
    preset === 'custom'
      ? (pointFields.map((field) => rangedNumber(field, values)) as BezierPoints)
      : [0, 0, 1, 1];
  const { keyword, points } = withToolError(() => resolveEasing(preset, custom));
  const css = generateEasingCss(points, rangedNumber(durationField, values));

  return cssToolResult({
    css,
    fields: values,
    fileName: 'easing.css',
    kind: 'easing',
    summary: summary(preset, keyword),
  });
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

/** The point rows stay visible, so a preset sample carries its four points too. */
const presetSample = (label: string, preset: string, duration = '300') => {
  const [x1, y1, x2, y2] = easingPresets[preset] ?? [0, 0, 1, 1];

  return sample(label, { duration, preset, x1: `${x1}`, x2: `${x2}`, y1: `${y1}`, y2: `${y2}` });
};

export const cssCubicBezierGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Shape a cubic-bezier() easing by dragging two control points or picking a CSS keyword or easings.net preset, then play it against linear motion.',
  fields: [presetField, ...pointFields, durationField],
  id: 'css-cubic-bezier-generator',
  keywords: ['cubic-bezier', 'easing', 'timing function', 'transition', 'animation curve'],
  name: 'Cubic-Bezier & Easing Editor',
  preview: 'css-easing',
  relatedToolIds: ['css-keyframes-generator', 'css-transform-generator'],
  run: ({ fields: values }) => runEasing(values),
  samples: [
    sample('Back overshoot', {}),
    sample('Material standard', { x1: '0.4', x2: '0.2', y1: '0', y2: '1' }),
    presetSample('Keyword ease-in-out', 'ease-in-out'),
    presetSample('Snappy out', 'easeOutCubic', '200'),
    presetSample('Gentle sine', 'easeInOutSine', '600'),
    presetSample('Spring out', 'easeOutBack', '450'),
  ],
};
