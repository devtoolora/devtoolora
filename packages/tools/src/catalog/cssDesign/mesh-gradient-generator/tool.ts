import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { meshGradient } from '@devtoolora/functions/css';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { colorField, rangeField, rangedNumber } from '../../../adapters/fields';

const colorDefaults = ['#f472b6', '#818cf8', '#38bdf8', '#facc15', '#34d399', '#fb923c'];
const counts = ['3', '4', '5', '6'];
const seedField = rangeField({
  defaultValue: '7',
  help: 'Moving the slider reshuffles the points.',
  id: 'seed',
  label: 'Seed',
  max: 9999,
  min: 1,
  step: 1,
});
const colorFields = colorDefaults.map((value, index) => ({
  ...colorField(`color${index + 1}`, `Color ${index + 1}`, value),
  ...(index >= 3 ? { visibleWhen: { field: 'count', is: counts.slice(index - 2) } } : {}),
}));

const fields: ToolField[] = [
  colorField('background', 'Background', '#f8fafc'),
  {
    defaultValue: '4',
    id: 'count',
    label: 'Colors',
    options: counts.map((value) => ({ label: value, value })),
    presentation: 'segmented',
    type: 'select',
  },
  ...colorFields,
  seedField,
];

function runMesh(values: Record<string, string>): ToolResult {
  const count = Number(values.count ?? '4');

  if (!counts.includes(String(count))) throw new ToolError('Colors must be one of: 3, 4, 5, 6.');

  const seed = rangedNumber(seedField, values);
  const colors = colorFields
    .slice(0, count)
    .map((field) => (values[field.id] ?? field.defaultValue ?? '').trim());
  const background = (values.background ?? '#f8fafc').trim();
  const { css, svg } = withToolError(() => meshGradient({ background, colors, seed }));
  const base = cssToolResult({
    css,
    fields: values,
    fileName: 'mesh-gradient.css',
    kind: 'mesh',
    summary: `Mesh gradient with ${count} colors, seed ${seed}.`,
  });

  return {
    ...base,
    artifacts: [
      ...(base.artifacts ?? []),
      {
        base64: encodeBase64Text(svg),
        fileName: 'mesh-gradient.svg',
        mimeType: 'image/svg+xml;charset=utf-8',
      },
    ],
  };
}

const sample = (label: string, values: Record<string, string>) => ({ fields: values, label });

export const meshGradientGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Layer 3 to 6 seeded radial gradients into a soft mesh background with CSS and an 800x600 SVG, and shuffle it with one slider.',
  fields,
  id: 'mesh-gradient-generator',
  keywords: ['mesh gradient', 'background', 'radial-gradient', 'blurry gradient', 'aurora'],
  name: 'Mesh Gradient Generator',
  preview: 'css-mesh',
  relatedToolIds: ['css-gradient-generator', 'color-mixer', 'color-scale-generator'],
  run: ({ fields: values }) => runMesh(values),
  samples: [
    sample('Pastel default', { count: '4', seed: '7' }),
    sample('Five colors', { count: '5', seed: '42' }),
    sample('Dark aurora', {
      background: '#0f172a',
      color1: '#22d3ee',
      color2: '#a78bfa',
      color3: '#34d399',
      count: '3',
      seed: '120',
    }),
    sample('Six colors', { count: '6', seed: '2024' }),
    sample('Warm sunset', {
      background: '#fff7ed',
      color1: '#f97316',
      color2: '#ec4899',
      color3: '#facc15',
      color4: '#ef4444',
      count: '4',
      seed: '99',
    }),
    sample('Another shuffle', { count: '4', seed: '8' }),
  ],
};
