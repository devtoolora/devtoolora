import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { rasterizeSvg } from '@devtoolora/functions/svg';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import { browserSafeCapabilities, numberOrUndefined, imageResult } from '../shared';

export const svgToPngTool: ToolDefinition = {
  id: 'svg-to-png',
  keywords: ['svg', 'png', 'rasterize', 'convert', 'export'],
  name: 'SVG to PNG',
  category: 'Images & Codes',
  description: 'Render pasted SVG markup to a local PNG artifact.',
  inputKind: 'text',
  outputKind: 'text',
  runRequires: [{ anyOf: ['$text', 'file'] }],
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save'],
  fields: [
    { id: 'file', label: 'SVG file (optional)', type: 'file', accept: '.svg,image/svg+xml' },
    { id: 'width', label: 'Max width', type: 'number', placeholder: 'optional' },
    { id: 'height', label: 'Max height', type: 'number', placeholder: 'optional' },
  ],
  relatedToolIds: ['svg-optimizer', 'image-tools', 'web-pwa-icon-generator'],
  samples: [
    {
      fields: { file: '', height: '', width: '256' },
      label: 'Checkmark icon at 256 px',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="#2563eb" stroke-width="2"/></svg>',
    },
    {
      fields: { file: '', height: '', width: '' },
      label: 'Badge at its own 48 × 32 size',
      text: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="#ffffff"/><circle cx="24" cy="16" r="10" fill="#2563eb"/></svg>',
    },
    {
      fields: { file: '', height: '80', width: '400' },
      label: 'Wide banner fitted into 400 × 80',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><rect width="160" height="40" fill="#0f172a"/><rect x="8" y="8" width="24" height="24" fill="#22c55e"/><path d="M44 14h104v4H44zM44 24h72v4H44z" fill="#e2e8f0"/></svg>',
    },
    {
      fields: { file: '', height: '', width: '512' },
      label: 'Shield app icon at 512 px',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#6366f1" stroke="#312e81" stroke-width="1"/></svg>',
    },
    {
      fields: { file: '', height: '', width: '128' },
      label: 'Heart icon at 128 px',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ef4444"/></svg>',
    },
    {
      fields: { file: '', height: '', width: '' },
      label: 'Group, gradient and text',
      text: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><defs><linearGradient id="g"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs><g fill="url(#g)" transform="translate(100 0)"><rect width="100" height="100"/></g><text x="10" y="58" font-family="sans-serif" font-size="30">Hello</text></svg>',
    },
    {
      fields: { file: '', height: '', width: '' },
      label: 'Circle on a transparent background',
      text: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#10b981"/></svg>',
    },
  ],
  run: ({ text, fields }) => svgToPng(text, fields),
};

async function svgToPng(text: string, fields: Record<string, string>): Promise<ToolResult> {
  let sourceText = text.trim();

  if (!sourceText && fields.file)
    sourceText = new TextDecoder().decode(fileBytesFromField(fields.file, 'SVG file').bytes);

  const result = await withToolErrorAsync(() =>
    rasterizeSvg(sourceText, {
      maxWidth: numberOrUndefined(fields.width),
      maxHeight: numberOrUndefined(fields.height),
    }),
  );

  return imageResult(result.bytes, 'image/png', 'rendered.png', 'SVG rendered to PNG.');
}
