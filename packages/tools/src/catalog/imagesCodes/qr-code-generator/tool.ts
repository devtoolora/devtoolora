import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { createQrSvg } from '@devtoolora/functions/qr';
import type { QrErrorCorrection } from '@devtoolora/functions/qr';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, parseBoundedInteger } from '../shared';

export const qrCodeGeneratorTool: ToolDefinition = {
  id: 'qr-code-generator',
  keywords: ['qr', 'qr code', 'barcode', 'svg', 'link'],
  name: 'QR Code Generator',
  category: 'Images & Codes',
  description: 'Generate a local scannable QR Code SVG from text.',
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save', 'copy', 'scratch'],
  fields: [
    { id: 'size', label: 'Size', type: 'number', defaultValue: '256' },
    { id: 'foreground', label: 'Foreground', type: 'text', defaultValue: '#000000' },
    { id: 'background', label: 'Background', type: 'text', defaultValue: '#ffffff' },
    { id: 'margin', label: 'Margin', type: 'number', defaultValue: '4' },
    {
      id: 'errorCorrection',
      label: 'Error correction',
      type: 'select',
      defaultValue: 'M',
      options: [
        { label: 'Low', value: 'L' },
        { label: 'Medium', value: 'M' },
        { label: 'Quartile', value: 'Q' },
        { label: 'High', value: 'H' },
      ],
    },
    {
      id: 'format',
      label: 'Export format',
      type: 'select',
      defaultValue: 'svg',
      options: [{ label: 'SVG', value: 'svg' }],
    },
  ],
  relatedToolIds: ['svg-to-png', 'qr-code-reader', 'wifi-qr'],
  samples: [
    {
      fields: {
        background: '#ffffff',
        errorCorrection: 'M',
        foreground: '#000000',
        format: 'svg',
        margin: '4',
        size: '256',
      },
      label: 'Website URL',
      text: 'https://example.com',
    },
    {
      fields: {
        background: '#f8fafc',
        errorCorrection: 'H',
        foreground: '#1e293b',
        format: 'svg',
        margin: '4',
        size: '320',
      },
      label: 'Wi-Fi network setup',
      text: 'WIFI:T:WPA;S:MyWiFi;P:secret123;;',
    },
    {
      fields: {
        background: '#ffffff',
        errorCorrection: 'M',
        foreground: '#0f172a',
        format: 'svg',
        margin: '4',
        size: '256',
      },
      label: 'Email mailto link',
      text: 'mailto:contact@example.com?subject=Inquiry',
    },
    {
      fields: {
        background: '#ffffff',
        errorCorrection: 'L',
        foreground: '#1d4ed8',
        format: 'svg',
        margin: '2',
        size: '200',
      },
      label: 'Phone number (tel:)',
      text: 'tel:+15551234567',
    },
    {
      fields: {
        background: '#ffffff',
        errorCorrection: 'H',
        foreground: '#111827',
        format: 'svg',
        margin: '4',
        size: '280',
      },
      label: 'High error correction payload',
      text: 'https://example.com/verify?token=7b9a4c1e8f2d',
    },
    {
      fields: {
        background: '#e0e7ff',
        errorCorrection: 'Q',
        foreground: '#4338ca',
        format: 'svg',
        margin: '4',
        size: '256',
      },
      label: 'Custom brand palette',
      text: 'https://developer.mozilla.org',
    },
  ],
  run: ({ text, fields }) => createQrSvgResult(text, fields),
};

export async function createQrSvgResult(
  text: string,
  fields: Record<string, string> = {},
): Promise<ToolResult> {
  const format = fields?.format || 'svg';

  if (format !== 'svg') {
    throw new ToolError(
      'Browser-safe QR export supports SVG. Use the native runtime for PNG, WebP or JPEG.',
    );
  }

  const size = parseBoundedInteger(fields.size, 'Size', 64, 2048, 256);
  const margin = parseBoundedInteger(fields.margin, 'Margin', 0, 16, 4);
  const foreground = fields.foreground || '#000000';
  const background = fields.background || '#ffffff';
  const errorCorrection = parseQrErrorCorrection(fields.errorCorrection);
  const svg = await withToolErrorAsync(() =>
    createQrSvg(text, { size, margin, foreground, background, errorCorrection }),
  );
  const base64 = base64Encode(new TextEncoder().encode(svg));

  return {
    text: svg,
    language: 'xml',
    summary: 'QR Code generated.',
    previewDataUri: `data:image/svg+xml;base64,${base64}`,
    artifact: { base64, mimeType: 'image/svg+xml', fileName: 'qr-code.svg' },
  };
}

function parseQrErrorCorrection(value: string | undefined): QrErrorCorrection {
  if (value === 'L' || value === 'M' || value === 'Q' || value === 'H') {
    return value;
  }

  return 'M';
}
