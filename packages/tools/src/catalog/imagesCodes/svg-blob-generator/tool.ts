import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { svgBlob } from '@devtoolora/functions/svg';
import { withToolError } from '../../../adapters/errors';
import { rangeField, rangedNumber } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const range = (id: string, label: string, defaultValue: string, min: number, max: number) =>
  rangeField({ defaultValue, id, label, max, min, step: 1 });
const seedField = range('seed', 'Seed', '42', 1, 9999);
const pointsField = range('points', 'Points', '6', 3, 12);
const randomnessField = rangeField({
  defaultValue: '50',
  id: 'randomness',
  label: 'Randomness',
  max: 100,
  min: 0,
  step: 1,
  unit: '%',
});
const sizeField = rangeField({
  defaultValue: '400',
  id: 'size',
  label: 'Size',
  max: 1000,
  min: 100,
  step: 1,
  unit: 'px',
});
const fillField: ToolField = {
  defaultValue: '#6366f1',
  id: 'fill',
  label: 'Fill',
  placeholder: '#6366f1',
  presentation: 'color',
  type: 'text',
};

function runBlob(values: Record<string, string>): ToolResult {
  const seed = rangedNumber(seedField, values);
  const svg = withToolError(() =>
    svgBlob({
      fill: values.fill ?? fillField.defaultValue ?? '',
      points: rangedNumber(pointsField, values),
      randomness: rangedNumber(randomnessField, values),
      seed,
      size: rangedNumber(sizeField, values),
    }),
  );
  const base64 = base64Encode(new TextEncoder().encode(svg));

  return {
    artifact: { base64, fileName: 'blob.svg', mimeType: 'image/svg+xml' },
    language: 'xml',
    previewDataUri: `data:image/svg+xml;base64,${base64}`,
    summary: `SVG blob generated from seed ${seed}.`,
    text: svg,
  };
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const svgBlobGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Generate a smooth, seeded organic blob as SVG and shuffle its shape with one slider.',
  fields: [seedField, pointsField, randomnessField, sizeField, fillField],
  freshResults: true,
  id: 'svg-blob-generator',
  inputKind: 'none',
  keywords: ['blob', 'organic shape', 'svg shape', 'random shape'],
  name: 'SVG Blob Generator',
  outputKind: 'text',
  relatedToolIds: ['svg-placeholder', 'svg-optimizer', 'svg-to-png'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => runBlob(fields),
  samples: [
    sample('Default blob', {}),
    sample('Soft circle', { points: '8', randomness: '10', seed: '7' }),
    sample('Wild shape', { points: '10', randomness: '100', seed: '321' }),
    sample('Triangle-ish', { fill: '#f43f5e', points: '3', randomness: '40', seed: '15' }),
    sample('Large teal', { fill: '#14b8a6', seed: '2024', size: '800' }),
    sample('Another shuffle', { seed: '43' }),
  ],
  supportsSelection: false,
};
