import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { editPath, type PathOperation } from '@devtoolora/functions/svg';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField, rangeField, rangedNumber } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const MAX_PREVIEW_POINTS = 2000;
const operations: readonly PathOperation[] = [
  'format',
  'absolute',
  'relative',
  'minify',
  'translate',
  'scale',
];

const precisionField = rangeField({
  defaultValue: '3',
  id: 'precision',
  label: 'Precision',
  max: 6,
  min: 0,
  unit: 'decimals',
});

const numberField = (
  id: string,
  label: string,
  defaultValue: string,
  operation: PathOperation,
) => ({
  defaultValue,
  id,
  label,
  type: 'number' as const,
  visibleWhen: { field: 'operation', is: [operation] },
});

const fieldNumber = (value: string | undefined, fallback: number): number =>
  value === undefined || value.trim() === '' ? fallback : Number(value.trim());

function edit(text: string, fields: Record<string, string>): ToolResult {
  const display = choiceField(
    fields.display,
    'stroke',
    ['stroke', 'fill'],
    'Choose stroke or fill as the display.',
  );
  const result = withToolError(() =>
    editPath(text, {
      display,
      dx: fieldNumber(fields.dx, 0),
      dy: fieldNumber(fields.dy, 0),
      operation: choiceField(
        fields.operation,
        'format',
        operations,
        'Choose format, absolute, relative, minify, translate or scale as the operation.',
      ),
      precision: rangedNumber(precisionField, fields),
      sx: fieldNumber(fields.sx, 1),
      sy: fieldNumber(fields.sy, 1),
    }),
  );

  return {
    artifact: {
      base64: encodeBase64Text(result.svg),
      fileName: 'path.svg',
      mimeType: 'image/svg+xml',
    },
    artifacts: [
      {
        base64: encodeBase64Text(result.report),
        fileName: 'path.json',
        mimeType: 'application/json',
      },
    ],
    summary: result.summary,
    svgPath: {
      bbox: result.bbox,
      d: result.text,
      display,
      pointCount: result.points.length,
      points: result.points.length > MAX_PREVIEW_POINTS ? [] : result.points,
    },
    text: result.text,
  };
}

const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

export const svgPathEditorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Format, minify, convert, move and scale SVG path data, with its bounding box, length and points.',
  fields: [
    {
      defaultValue: 'format',
      id: 'operation',
      label: 'Operation',
      options: [
        { label: 'Format', value: 'format' },
        { label: 'Absolute', value: 'absolute' },
        { label: 'Relative', value: 'relative' },
        { label: 'Minify', value: 'minify' },
        { label: 'Translate', value: 'translate' },
        { label: 'Scale', value: 'scale' },
      ],
      type: 'select',
    },
    precisionField,
    numberField('dx', 'Offset x', '0', 'translate'),
    numberField('dy', 'Offset y', '0', 'translate'),
    numberField('sx', 'Scale x', '1', 'scale'),
    numberField('sy', 'Scale y', '1', 'scale'),
    {
      defaultValue: 'stroke',
      id: 'display',
      label: 'Display',
      options: [
        { label: 'Stroke', value: 'stroke' },
        { label: 'Fill', value: 'fill' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'svg-path-editor',
  inputKind: 'text',
  inputPresentation: {
    label: 'Path data or SVG',
    placeholder: 'M10 10 L 90 90 or <path d="…"/>',
  },
  keywords: ['svg path', 'path data', 'd attribute', 'bezier', 'minify path', 'path bounding box'],
  name: 'SVG Path Editor',
  outputKind: 'text',
  preview: 'svg-path',
  relatedToolIds: ['svg-optimizer', 'svg-to-data-uri', 'svg-to-png'],
  resultActions: ['save', 'copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) => edit(text, fields),
  samples: [
    { label: 'Heart icon, one command per line', text: HEART },
    {
      fields: { operation: 'absolute' },
      label: 'Relative check mark to absolute',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>',
    },
    {
      fields: { operation: 'relative' },
      label: 'Square to relative commands',
      text: 'M10 10 L 30 10 L 30 30 L 10 30 Z',
    },
    {
      fields: { operation: 'minify' },
      label: 'Minify padded numbers',
      text: 'M 0.50 0.50 L 1.00 0.00 L 1.50 0.50',
    },
    {
      fields: { dx: '5', dy: '-2.5', operation: 'translate' },
      label: 'Move a path element',
      text: '<path d="M0 0 H 10 V 10 H 0 Z"/>',
    },
    {
      fields: { operation: 'scale', sx: '1', sy: '0.5' },
      label: 'Squash an arc (converted to curves)',
      text: 'M 10 50 A 40 40 0 0 1 90 50',
    },
  ],
  supportsSelection: true,
};
