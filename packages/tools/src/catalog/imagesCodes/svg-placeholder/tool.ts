import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { createSvgPlaceholder as generateSvgPlaceholder } from '@devtoolora/functions/svg';
import { withToolError, withToolErrorAsync } from '../../../adapters/errors';
import { choiceField, rangeField, rangedNumber } from '../../../adapters/fields';
import { browserSafeCapabilities, imageResult, parseBoundedInteger } from '../shared';

const formats = ['svg', 'png', 'jpeg'] as const;
const qualityField = rangeField({
  defaultValue: '85',
  id: 'quality',
  label: 'Quality',
  max: 100,
  min: 1,
  unit: '%',
  visibleWhen: { field: 'format', is: ['jpeg'] },
});

export const svgPlaceholderTool: ToolDefinition = {
  id: 'svg-placeholder',
  keywords: ['placeholder image', 'dummy image', 'mockup', 'wireframe', 'svg'],
  name: 'SVG Placeholder',
  category: 'Images & Codes',
  description: 'Generate a lightweight SVG placeholder image.',
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save', 'copy', 'scratch'],
  fields: [
    { id: 'width', label: 'Width', type: 'number', defaultValue: '1200' },
    { id: 'height', label: 'Height', type: 'number', defaultValue: '630' },
    { id: 'text', label: 'Label', placeholder: 'the size, such as 1200x630', type: 'text' },
    { id: 'background', label: 'Background', type: 'text', defaultValue: '#1f2937' },
    { id: 'foreground', label: 'Foreground', type: 'text', defaultValue: '#ffffff' },
    {
      id: 'format',
      label: 'Format',
      type: 'select',
      defaultValue: 'svg',
      options: [
        { label: 'SVG', value: 'svg' },
        { label: 'PNG', value: 'png' },
        { label: 'JPEG', value: 'jpeg' },
      ],
    },
    qualityField,
  ],
  relatedToolIds: ['svg-to-png', 'svg-optimizer', 'meta-tag-generator'],
  samples: [
    {
      fields: {
        background: '#1e293b',
        foreground: '#f8fafc',
        height: '630',
        text: '1200x630',
        width: '1200',
      },
      label: 'Open Graph / social share (1200x630)',
    },
    {
      fields: {
        background: '#3b82f6',
        foreground: '#ffffff',
        height: '400',
        text: 'Avatar',
        width: '400',
      },
      label: 'Square avatar (400x400)',
    },
    {
      fields: {
        background: '#0f172a',
        foreground: '#94a3b8',
        height: '600',
        text: 'Hero Banner 1920x600',
        width: '1920',
      },
      label: 'Hero banner (1920x600)',
    },
    {
      fields: {
        background: '#334155',
        foreground: '#f1f5f9',
        height: '90',
        text: 'Leaderboard 728x90',
        width: '728',
      },
      label: 'Leaderboard ad (728x90)',
    },
    {
      fields: {
        background: '#111827',
        foreground: '#e5e7eb',
        height: '1334',
        text: '750 x 1334',
        width: '750',
      },
      label: 'Mobile viewport (750x1334)',
    },
    {
      fields: {
        background: '#475569',
        foreground: '#ffffff',
        height: '150',
        text: '150x150',
        width: '150',
      },
      label: 'Square thumbnail (150x150)',
    },
  ],
  run: ({ fields }) => createSvgPlaceholder(fields),
};

async function createSvgPlaceholder(fields: Record<string, string>): Promise<ToolResult> {
  const width = parseBoundedInteger(fields.width, 'Width', 1, 10000, 1200);
  const height = parseBoundedInteger(fields.height, 'Height', 1, 10000, 630);
  const format = choiceField(fields.format, 'svg', formats, 'Format must be SVG, PNG or JPEG.');
  const background = fields.background || '#1f2937';
  const foreground = fields.foreground || '#ffffff';

  withToolError(() => imageFunctions.checkPlaceholderColors(background, foreground));

  if (format !== 'svg') {
    const image = await withToolErrorAsync(() =>
      imageFunctions.createRasterPlaceholder({
        background,
        foreground,
        format,
        height,
        label: fields.text || `${width}x${height}`,
        quality: rangedNumber(qualityField, fields),
        width,
      }),
    );
    const output = imageResult(
      image.bytes,
      image.mimeType,
      `placeholder-${width}x${height}.${format === 'jpeg' ? 'jpg' : 'png'}`,
      `${format.toUpperCase()} placeholder generated.`,
    );

    return { ...output, text: output.previewDataUri ?? '' };
  }

  const svg = generateSvgPlaceholder({
    width,
    height,
    label: fields.text,
    background: fields.background,
    foreground: fields.foreground,
  });
  const base64 = base64Encode(new TextEncoder().encode(svg));

  return {
    text: svg,
    language: 'xml',
    summary: 'SVG placeholder generated.',
    previewDataUri: `data:image/svg+xml;base64,${base64}`,
    artifact: { base64, mimeType: 'image/svg+xml', fileName: 'placeholder.svg' },
  };
}
