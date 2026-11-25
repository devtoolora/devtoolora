import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { dataUriFromBytes } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField, zipArtifact } from '../../../adapters/files';
import { browserSafeCapabilities, parseBoundedInteger, SAMPLE_PNG_DATA_URI } from '../shared';

export const webPwaIconGeneratorTool: ToolDefinition = {
  id: 'web-pwa-icon-generator',
  keywords: ['favicon', 'pwa', 'apple-touch-icon', 'manifest icons', 'app icon'],
  name: 'Web & PWA Icon Generator',
  category: 'Images & Codes',
  description:
    'Generate a complete favicon and PWA icon package from one local image or text mark.',
  inputKind: 'none',
  runRequires: [
    { anyOf: ['image'], when: { field: 'sourceMode', isNot: ['text'] } },
    { anyOf: ['textLabel', 'appName'], when: { field: 'sourceMode', is: ['text'] } },
  ],
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save'],
  fields: [
    {
      id: 'sourceMode',
      label: 'Source',
      type: 'select',
      defaultValue: 'image',
      options: [
        { label: 'Image file', value: 'image' },
        { label: 'Text mark', value: 'text' },
      ],
    },
    {
      id: 'image',
      label: 'Source image',
      type: 'file',
      accept: 'image/*',
      visibleWhen: { field: 'sourceMode', is: ['image'] },
    },
    {
      id: 'textLabel',
      label: 'Text label',
      type: 'text',
      defaultValue: 'A',
      visibleWhen: { field: 'sourceMode', is: ['text'] },
    },
    {
      id: 'textForeground',
      label: 'Text color',
      type: 'text',
      defaultValue: '#ffffff',
      visibleWhen: { field: 'sourceMode', is: ['text'] },
    },
    {
      id: 'textBackground',
      label: 'Icon background',
      type: 'text',
      defaultValue: '#2563eb',
      visibleWhen: { field: 'sourceMode', is: ['text'] },
    },
    {
      id: 'textRadius',
      label: 'Border radius',
      type: 'number',
      defaultValue: '96',
      visibleWhen: { field: 'sourceMode', is: ['text'] },
    },
    { id: 'appName', label: 'App name', type: 'text', defaultValue: 'My App' },
    { id: 'themeColor', label: 'Theme color', type: 'text', defaultValue: '#ffffff' },
    { id: 'backgroundColor', label: 'Background color', type: 'text', defaultValue: '#ffffff' },
  ],
  relatedToolIds: ['meta-tag-generator', 'svg-to-png', 'image-tools'],
  samples: [
    {
      fields: {
        appName: 'Dev Toolora',
        backgroundColor: '#0f172a',
        sourceMode: 'text',
        textBackground: '#2563eb',
        textForeground: '#ffffff',
        textLabel: 'SF',
        textRadius: '96',
        themeColor: '#2563eb',
      },
      label: 'Text mark "SF" (blue)',
    },
    {
      fields: {
        appName: 'Super App',
        backgroundColor: '#ffffff',
        sourceMode: 'text',
        textBackground: '#7c3aed',
        textForeground: '#ffffff',
        textLabel: '🚀',
        textRadius: '128',
        themeColor: '#7c3aed',
      },
      label: 'Text mark "🚀" (purple rocket)',
    },
    {
      fields: {
        appName: 'Alpha Studio',
        backgroundColor: '#0f172a',
        sourceMode: 'text',
        textBackground: '#0f172a',
        textForeground: '#f8fafc',
        textLabel: 'A',
        textRadius: '64',
        themeColor: '#0f172a',
      },
      label: 'Dark minimal "A" (slate)',
    },
    {
      fields: {
        appName: 'JS Utilities',
        backgroundColor: '#ffffff',
        sourceMode: 'text',
        textBackground: '#10b981',
        textForeground: '#022c22',
        textLabel: 'JS',
        textRadius: '48',
        themeColor: '#10b981',
      },
      label: 'Emerald code mark "JS"',
    },
    {
      fields: {
        appName: 'Status Monitor',
        backgroundColor: '#ffffff',
        sourceMode: 'text',
        textBackground: '#f59e0b',
        textForeground: '#78350f',
        textLabel: '!',
        textRadius: '96',
        themeColor: '#f59e0b',
      },
      label: 'Amber alert mark "!"',
    },
    {
      fields: {
        appName: 'Dev Toolora',
        backgroundColor: '#ffffff',
        image: SAMPLE_PNG_DATA_URI,
        sourceMode: 'image',
        themeColor: '#2563eb',
      },
      label: 'Image source generation',
    },
  ],
  run: ({ fields }) => createWebPwaIconPack(fields),
};

async function createWebPwaIconPack(fields: Record<string, string>): Promise<ToolResult> {
  if (fields.sourceMode !== 'text' && !fields.image)
    throw new ToolError('Choose a Source image, or set Source to Text mark.');

  const source =
    fields.sourceMode === 'text'
      ? undefined
      : { name: fields.imageName || 'image', ...fileBytesFromField(fields.image, 'Source image') };
  const textRadius = source
    ? undefined
    : parseBoundedInteger(fields.textRadius, 'Border radius', 0, 256, 96);
  const assets = await withToolErrorAsync(() =>
    imageFunctions.createPwaIconPack({
      source,
      textLabel: fields.textLabel,
      textForeground: fields.textForeground,
      textBackground: fields.textBackground,
      textRadius,
      appName: fields.appName,
      themeColor: fields.themeColor,
      backgroundColor: fields.backgroundColor,
    }),
  );
  const preview = (assets.find((asset) => asset.name === 'icon-512.png') ?? assets[0])?.bytes;

  if (!preview) throw new ToolError('The icon pack did not produce any images.');

  return {
    text: `Generated ${assets.length} web icon assets.`,
    previewDataUri: dataUriFromBytes(preview, 'image/png'),
    artifact: zipArtifact(assets, 'web-pwa-icons.zip'),
  };
}
