import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import {
  generateGradientCss,
  parseGradientStops,
  type GradientOptions,
} from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { choiceField, rangeField, rangedNumber } from '../../../adapters/fields';
import { cssGeneratorDefaults, cssToolResult } from '../shared';

const defaultStops = '[{"color":"#2563eb","position":0},{"color":"#9333ea","position":100}]';
const angleField = rangeField({
  defaultValue: '135',
  id: 'angle',
  label: 'Angle',
  max: 360,
  min: 0,
  unit: 'deg',
  visibleWhen: { field: 'type', is: ['linear', 'conic'] },
});
const positionFields = (['X', 'Y'] as const).map((axis) =>
  rangeField({
    defaultValue: '50',
    id: `position${axis}`,
    label: `Position ${axis}`,
    max: 100,
    min: 0,
    unit: '%',
    visibleWhen: { field: 'type', is: ['radial', 'conic'] },
  }),
);

const fields: ToolField[] = [
  {
    defaultValue: 'linear',
    id: 'type',
    label: 'Type',
    options: [
      { label: 'Linear', value: 'linear' },
      { label: 'Radial', value: 'radial' },
      { label: 'Conic', value: 'conic' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  angleField,
  {
    defaultValue: 'circle',
    id: 'shape',
    label: 'Shape',
    options: [
      { label: 'Circle', value: 'circle' },
      { label: 'Ellipse', value: 'ellipse' },
    ],
    type: 'select',
    visibleWhen: { field: 'type', is: ['radial'] },
  },
  ...positionFields,
  { defaultValue: 'false', id: 'repeating', label: 'Repeating', type: 'checkbox' },
  {
    defaultValue: 'default',
    id: 'interpolation',
    label: 'Interpolation',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'OKLab', value: 'oklab' },
      { label: 'OKLCH', value: 'oklch' },
    ],
    type: 'select',
  },
  { defaultValue: defaultStops, id: 'stops', label: 'Stops', type: 'textarea' },
];

function gradientOptions(values: Record<string, string>): GradientOptions {
  const type = choiceField(
    values.type,
    'linear',
    ['linear', 'radial', 'conic'] as const,
    'Type must be one of: linear, radial, conic.',
  );
  const [positionX, positionY] = positionFields.map((field) =>
    type === 'linear' ? 50 : rangedNumber(field, values),
  );

  return {
    angle: type === 'radial' ? 0 : rangedNumber(angleField, values),
    interpolation: choiceField(
      values.interpolation,
      'default',
      ['default', 'oklab', 'oklch'] as const,
      'Interpolation must be one of: default, oklab, oklch.',
    ),
    positionX: positionX ?? 50,
    positionY: positionY ?? 50,
    repeating:
      choiceField(
        values.repeating,
        'false',
        ['false', 'true'] as const,
        'Repeating must be one of: false, true.',
      ) === 'true',
    shape: choiceField(
      values.shape,
      'circle',
      ['circle', 'ellipse'] as const,
      'Shape must be one of: circle, ellipse.',
    ),
    stops: withToolError(() => parseGradientStops(values.stops ?? defaultStops)),
    type,
  };
}

function runGradient(values: Record<string, string>): ToolResult {
  const { css, reordered } = generateGradientCss(gradientOptions(values));
  const order = reordered ? ' Stops were printed sorted by position, so their order changed.' : '';

  return cssToolResult({
    css,
    fields: values,
    fileName: 'gradient.css',
    kind: 'gradient',
    summary: `Gradient background-image generated.${order} The preview swatch size and radius are not exported.`,
  });
}

const sample = (label: string, values: Record<string, string>) => ({
  fields: { interpolation: 'default', repeating: 'false', ...values },
  label,
});

export const cssGradientGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Build linear, radial and conic CSS gradients with 2 to 8 draggable color stops, perceptual interpolation and a live preview.',
  fields,
  id: 'css-gradient-generator',
  keywords: ['linear-gradient', 'radial-gradient', 'conic-gradient', 'color stops', 'background'],
  name: 'CSS Gradient Generator',
  preview: 'css-gradient',
  relatedToolIds: ['css-box-shadow-generator', 'color-converter', 'color-palette'],
  run: ({ fields: values }) => runGradient(values),
  samples: [
    sample('Blue to violet', { angle: '135', stops: defaultStops, type: 'linear' }),
    sample('Sunset in OKLCH', {
      angle: '90',
      interpolation: 'oklch',
      stops:
        '[{"color":"#f97316","position":0},{"color":"#ec4899","position":50},{"color":"#6366f1","position":100}]',
      type: 'linear',
    }),
    sample('Radial spotlight', {
      positionX: '30',
      positionY: '30',
      shape: 'circle',
      stops:
        '[{"color":"#fde68a","position":0},{"color":"#f59e0b","position":35},{"color":"#1e293b","position":100}]',
      type: 'radial',
    }),
    sample('Conic color wheel', {
      angle: '0',
      interpolation: 'oklch',
      stops:
        '[{"color":"red","position":0},{"color":"yellow","position":16.67},{"color":"lime","position":33.33},{"color":"cyan","position":50},{"color":"blue","position":66.67},{"color":"magenta","position":83.33},{"color":"red","position":100}]',
      type: 'conic',
    }),
    sample('Repeating stripes', {
      angle: '45',
      repeating: 'true',
      stops:
        '[{"color":"#0f172a","position":0},{"color":"#0f172a","position":20},{"color":"#facc15","position":20},{"color":"#facc15","position":40}]',
      type: 'linear',
    }),
    sample('Fade to transparent', {
      angle: '180',
      stops:
        '[{"color":"rgb(15 23 42 / 0.8)","position":0},{"color":"transparent","position":100}]',
      type: 'linear',
    }),
  ],
};

const aliasFields = (type: string): ToolField[] =>
  fields.map((field) => (field.id === 'type' ? { ...field, defaultValue: type } : field));
const aliasSamples = (type: string): ToolDefinition['samples'] =>
  cssGradientGeneratorTool.samples?.filter((entry) => entry.fields?.type === type);

export const radialGradientGeneratorTool: ToolDefinition = {
  ...cssGradientGeneratorTool,
  aliasOf: 'css-gradient-generator',
  description:
    'Build CSS radial gradients with circle or ellipse shapes, a movable center and 2 to 8 color stops.',
  fields: aliasFields('radial'),
  id: 'radial-gradient-generator',
  name: 'Radial Gradient Generator',
  samples: aliasSamples('radial'),
};

export const conicGradientGeneratorTool: ToolDefinition = {
  ...cssGradientGeneratorTool,
  aliasOf: 'css-gradient-generator',
  description:
    'Build CSS conic gradients for color wheels, pie charts and sweeps with a start angle and center.',
  fields: aliasFields('conic'),
  id: 'conic-gradient-generator',
  name: 'Conic Gradient Generator',
  samples: aliasSamples('conic'),
};
