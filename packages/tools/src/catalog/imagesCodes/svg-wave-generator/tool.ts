import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { svgWave } from '@devtoolora/functions/svg';
import { withToolError } from '../../../adapters/errors';
import { choiceField, colorField, rangeField, rangedNumber } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const range = (
  id: string,
  label: string,
  defaultValue: string,
  min: number,
  max: number,
  unit?: string,
) => rangeField({ defaultValue, id, label, max, min, step: 1, unit });
const widthField = range('width', 'Width', '1440', 320, 2560, 'px');
const heightField = range('height', 'Height', '320', 50, 600, 'px');
const peaksField = range('peaks', 'Peaks', '4', 1, 12);
const amplitudeField = range('amplitude', 'Amplitude', '50', 5, 100, '%');
const layersField = range('layers', 'Layers', '1', 1, 4);
const seedField: ToolField = {
  ...range('seed', 'Seed', '11', 1, 9999),
  help: 'Shuffles the smooth style.',
  visibleWhen: { field: 'style', is: ['smooth'] },
};
const mainColorField = colorField('color', 'Color', '#2563eb');
const segmentedField = (id: string, label: string, values: string[]): ToolField => ({
  defaultValue: values[0],
  id,
  label,
  options: values.map((value) => ({ label: value[0]?.toUpperCase() + value.slice(1), value })),
  presentation: 'segmented',
  type: 'select',
});
const styleField = segmentedField('style', 'Style', ['smooth', 'sine']);
const positionField = segmentedField('position', 'Position', ['bottom', 'top']);

function runWave(values: Record<string, string>): ToolResult {
  const style = choiceField(
    values.style,
    'smooth',
    ['smooth', 'sine'] as const,
    'Style must be one of: smooth, sine.',
  );
  const seed = style === 'smooth' ? rangedNumber(seedField, values) : 1;
  const svg = withToolError(() =>
    svgWave({
      amplitude: rangedNumber(amplitudeField, values),
      color: values.color ?? mainColorField.defaultValue ?? '',
      height: rangedNumber(heightField, values),
      layers: rangedNumber(layersField, values),
      peaks: rangedNumber(peaksField, values),
      position: choiceField(
        values.position,
        'bottom',
        ['bottom', 'top'] as const,
        'Position must be one of: bottom, top.',
      ),
      seed,
      style,
      width: rangedNumber(widthField, values),
    }),
  );
  const base64 = base64Encode(new TextEncoder().encode(svg));

  return {
    artifact: { base64, fileName: 'wave.svg', mimeType: 'image/svg+xml' },
    language: 'xml',
    previewDataUri: `data:image/svg+xml;base64,${base64}`,
    summary:
      style === 'smooth' ? `SVG wave generated from seed ${seed}.` : 'SVG sine wave generated.',
    text: svg,
  };
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const svgWaveGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Generate a seeded SVG wave divider with up to four layers, as a smooth random curve or a sine wave.',
  fields: [
    styleField,
    widthField,
    heightField,
    peaksField,
    amplitudeField,
    layersField,
    positionField,
    mainColorField,
    seedField,
  ],
  freshResults: true,
  id: 'svg-wave-generator',
  inputKind: 'none',
  keywords: ['wave', 'section divider', 'svg divider', 'sine wave', 'background'],
  name: 'SVG Wave Generator',
  outputKind: 'text',
  relatedToolIds: ['svg-blob-generator', 'svg-placeholder', 'svg-optimizer'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => runWave(fields),
  samples: [
    sample('Default smooth wave', {}),
    sample('Sine wave', { peaks: '3', style: 'sine' }),
    sample('Three layers', { layers: '3', seed: '5' }),
    sample('Top divider', { color: '#0f172a', position: 'top', seed: '99' }),
    sample('Gentle ripple', { amplitude: '15', peaks: '8', style: 'sine' }),
    sample('Four layers', { color: '#10b981', layers: '4', seed: '321' }),
  ],
  supportsSelection: false,
};
