import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { filterFunctions, generateFilterCss, type FilterFunction } from '@devtoolora/functions/css';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const camelCase = (id: string): string =>
  id.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
const label = (id: string): string =>
  id.replace(
    /(^|-)(\w)/g,
    (_, dash: string, letter: string) => `${dash ? ' ' : ''}${letter.toUpperCase()}`,
  );

const functionFields = filterFunctions.map((entry) => ({
  entry,
  field: rangeField({
    defaultValue: String(entry.identity),
    id: camelCase(entry.id),
    label: label(entry.id),
    max: entry.max,
    min: entry.min,
    unit: entry.unit,
  }),
}));

const targetField = (target: string): ToolField => ({
  defaultValue: target,
  help: 'filter changes the element itself; backdrop-filter changes what shows behind it.',
  id: 'target',
  label: 'Target',
  options: [
    { label: 'filter', value: 'filter' },
    { label: 'backdrop-filter', value: 'backdrop-filter' },
  ],
  presentation: 'segmented',
  type: 'select',
});

function runFilter(values: Record<string, string>): ToolResult {
  const target = values.target ?? 'filter';

  if (target !== 'filter' && target !== 'backdrop-filter')
    throw new ToolError('Target must be one of: filter, backdrop-filter.');

  const numbers = Object.fromEntries(
    functionFields.map(({ entry, field }) => [entry.id, rangedNumber(field, values)]),
  ) as Record<FilterFunction, number>;

  return cssToolResult({
    css: generateFilterCss(numbers, target),
    fields: values,
    fileName: 'filter.css',
    kind: 'filter',
    summary:
      'Filter functions at their identity value are omitted and the order is fixed. The demo scene and card in the preview are not exported; drop-shadow() is not included.',
  });
}

const sample = (labelText: string, values: Record<string, string>, target = 'filter') => ({
  fields: { target, ...values },
  label: labelText,
});

const samplesFor = (target: string) => [
  sample('Subtle punch', { brightness: '110', contrast: '120', saturate: '130' }, target),
  sample('Frosted blur', { blur: '8', brightness: '105', saturate: '150' }, target),
  sample('Vintage sepia', { contrast: '90', sepia: '60', saturate: '120' }, target),
  sample('Black and white', { contrast: '115', grayscale: '100' }, target),
  sample('Hue shift', { hueRotate: '180', saturate: '120' }, target),
  sample('Inverted dim', { brightness: '80', invert: '100' }, target),
];

const baseTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Combine blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate and sepia with sliders for filter or backdrop-filter, and see them on a live demo scene.',
  fields: [targetField('filter'), ...functionFields.map(({ field }) => field)],
  id: 'css-filter-generator',
  keywords: ['filter', 'backdrop-filter', 'blur', 'brightness', 'grayscale', 'sepia', 'hue-rotate'],
  name: 'CSS Filter Generator',
  preview: 'css-filter',
  relatedToolIds: ['css-box-shadow-generator', 'image-tools'],
  run: ({ fields: values }) => runFilter(values),
  samples: samplesFor('filter'),
};

export const cssFilterGeneratorTool: ToolDefinition = baseTool;

export const cssBackdropFilterGeneratorTool: ToolDefinition = {
  ...baseTool,
  aliasOf: 'css-filter-generator',
  description:
    'Build a CSS backdrop-filter for frosted-glass cards and overlays, with blur, brightness and saturate sliders and a live patterned backdrop.',
  fields: [targetField('backdrop-filter'), ...functionFields.map(({ field }) => field)],
  id: 'css-backdrop-filter-generator',
  name: 'CSS Backdrop Filter Generator',
  samples: samplesFor('backdrop-filter'),
};
