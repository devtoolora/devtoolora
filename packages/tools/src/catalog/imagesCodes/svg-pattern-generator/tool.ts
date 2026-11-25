import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { svgPattern } from '@devtoolora/functions/svg';
import { withToolError } from '../../../adapters/errors';
import { colorField, rangeField, rangedNumber } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const types = ['dots', 'grid', 'diagonal', 'zigzag', 'checkers'] as const;

type PatternType = (typeof types)[number];

const typeField: ToolField = {
  defaultValue: 'dots',
  id: 'type',
  label: 'Pattern',
  options: types.map((value) => ({ label: value[0]?.toUpperCase() + value.slice(1), value })),
  presentation: 'segmented',
  type: 'select',
};
const tileSizeField = rangeField({
  defaultValue: '24',
  id: 'tileSize',
  label: 'Tile size',
  max: 200,
  min: 4,
  step: 1,
  unit: 'px',
});
const strokeSizeField = rangeField({
  defaultValue: '4',
  help: 'Dot diameter or line width. At most the tile size for dots, half of it for lines.',
  id: 'strokeSize',
  label: 'Stroke size',
  max: 50,
  min: 1,
  step: 1,
  unit: 'px',
});
const foregroundField = colorField('foreground', 'Foreground', '#6366f1');
const backgroundField = colorField('background', 'Background', '#ffffff');
const transparentField: ToolField = {
  defaultValue: 'false',
  id: 'transparent',
  label: 'Transparent background',
  type: 'checkbox',
};

function runPattern(values: Record<string, string>): ToolResult {
  const type = (values.type ?? typeField.defaultValue ?? '') as PatternType;

  if (!types.includes(type)) throw new ToolError(`Pattern must be one of: ${types.join(', ')}.`);

  const { css, previewSvg, tile } = withToolError(() =>
    svgPattern({
      background:
        values.transparent === 'true'
          ? undefined
          : (values.background ?? backgroundField.defaultValue),
      foreground: values.foreground ?? foregroundField.defaultValue ?? '',
      strokeSize: rangedNumber(strokeSizeField, values),
      tileSize: rangedNumber(tileSizeField, values),
      type,
    }),
  );

  return {
    artifact: {
      base64: base64Encode(new TextEncoder().encode(tile)),
      fileName: 'pattern-tile.svg',
      mimeType: 'image/svg+xml',
    },
    language: 'css',
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(previewSvg))}`,
    summary: `SVG ${type} pattern with a ${values.tileSize ?? '24'}px tile.`,
    text: css,
  };
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const svgPatternGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Generate a seamless SVG background pattern of dots, grid, diagonal lines, zigzag or checkers as a ready CSS rule.',
  fields: [
    typeField,
    tileSizeField,
    strokeSizeField,
    foregroundField,
    backgroundField,
    transparentField,
  ],
  freshResults: true,
  id: 'svg-pattern-generator',
  inputKind: 'none',
  keywords: ['pattern', 'background pattern', 'dots', 'stripes', 'checkerboard', 'seamless'],
  name: 'SVG Pattern Generator',
  outputKind: 'text',
  relatedToolIds: ['svg-blob-generator', 'svg-wave-generator', 'svg-optimizer'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => runPattern(fields),
  samples: [
    sample('Polka dots', { strokeSize: '6' }),
    sample('Grid paper', { foreground: '#94a3b8', strokeSize: '1', type: 'grid' }),
    sample('Diagonal stripes', { tileSize: '16', type: 'diagonal' }),
    sample('Zigzag', { foreground: '#f43f5e', tileSize: '32', type: 'zigzag' }),
    sample('Checkerboard', { foreground: '#0f172a', tileSize: '40', type: 'checkers' }),
    sample('Transparent dots', { transparent: 'true', type: 'dots' }),
  ],
  supportsSelection: false,
};
