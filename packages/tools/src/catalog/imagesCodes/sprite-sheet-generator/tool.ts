import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { choiceField, rangeField, rangedNumber } from '../../../adapters/fields';
import { filesFromField } from '../../../adapters/files';
import { browserSafeCapabilities } from '../shared';

const layouts = ['packed', 'horizontal', 'vertical', 'grid'] as const;
const paddingField = rangeField({
  defaultValue: '2',
  id: 'padding',
  label: 'Padding',
  max: 64,
  min: 0,
  unit: 'px',
});

const SPRITE_ICONS = JSON.stringify([
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJUlEQVR4nGNQTX79n5aYYdSCUQtGLRi1YNSCUQtGLRi1YGhYAABNdoDMVvUsXgAAAABJRU5ErkJggg==',
    name: 'home.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAHklEQVR4nGMQ2Nn4n5qYYdTAUQNHDRw1cNTAkWogANHikj4FrxPTAAAAAElFTkSuQmCC',
    name: 'search.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAWCAYAAADJqhx8AAAAHklEQVR4nGP4Oo/7PyWYYdSAUQNGDRg1YNQA6hkAABs8mA6ceXA+AAAAAElFTkSuQmCC',
    name: 'bell.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAHElEQVR4nGN47+LynxqYYdSgUYNGDRo1aLgZBACtfB2G5csw8AAAAABJRU5ErkJggg==',
    name: 'star.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAGUlEQVR4nGOosXr7n1zMMKp5VPOoZiprBgDtR1CB5u2NPAAAAABJRU5ErkJggg==',
    name: 'ikona-ž.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAMCAYAAAB1Lg0yAAAAHUlEQVR4nGPgF9f6PxCYYdTiUYtHLR61eNRiYjEASkrXKIpFlC0AAAAASUVORK5CYII=',
    name: '2x-badge.png',
  },
]);

const text = (value: string, mimeType: string) => ({
  base64: base64Encode(new TextEncoder().encode(value)),
  mimeType,
});

async function generate(fields: Record<string, string>): Promise<ToolResult> {
  const files = filesFromField(fields.images, 'Images');
  const sheet = await withToolErrorAsync(() =>
    imageFunctions.createSpriteSheet(
      files.map(({ bytes, mimeType, name }) => ({ bytes, mimeType, name })),
      {
        layout: choiceField(
          fields.layout,
          'packed',
          layouts,
          'Choose packed, horizontal, vertical or grid as the layout.',
        ),
        padding: rangedNumber(paddingField, fields),
        pixelRatio:
          choiceField(fields.pixelRatio, '1', ['1', '2'], 'Choose 1 or 2 as the pixel ratio.') ===
          '2'
            ? 2
            : 1,
        prefix: fields.classPrefix || 'sprite',
      },
    ),
  );

  return {
    artifact: { base64: base64Encode(sheet.png), fileName: 'sprite.png', mimeType: 'image/png' },
    artifacts: [
      { ...text(sheet.css, 'text/css;charset=utf-8'), fileName: 'sprite.css' },
      { ...text(sheet.json, 'application/json;charset=utf-8'), fileName: 'sprite.json' },
    ],
    language: 'css',
    previewDataUri: dataUriFromBytes(sheet.png, 'image/png'),
    summary: sheet.summary,
    text: sheet.css,
  };
}

const sample = (label: string, fields: Record<string, string>) => ({
  fields: { images: SPRITE_ICONS, ...fields },
  label,
});

export const spriteSheetGeneratorTool: ToolDefinition = {
  id: 'sprite-sheet-generator',
  keywords: ['sprite', 'css sprites', 'texture atlas', 'spritesheet', 'icons'],
  name: 'CSS Sprite Sheet Generator',
  category: 'Images & Codes',
  description: 'Combine local images into one sprite sheet PNG with CSS classes and a JSON map.',
  inputKind: 'none',
  runRequires: [{ anyOf: ['images'] }],
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  resultActions: ['save', 'copy'],
  fields: [
    {
      accept: 'image/png,image/jpeg,image/webp,image/gif',
      id: 'images',
      label: 'Images',
      maxBytes: 10 * 1024 * 1024,
      multiple: true,
      required: true,
      type: 'file',
    },
    {
      defaultValue: 'packed',
      id: 'layout',
      label: 'Layout',
      options: [
        { label: 'Packed', value: 'packed' },
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical', value: 'vertical' },
        { label: 'Grid', value: 'grid' },
      ],
      type: 'select',
    },
    paddingField,
    { defaultValue: 'sprite', id: 'classPrefix', label: 'Class prefix', type: 'text' },
    {
      defaultValue: '1',
      id: 'pixelRatio',
      label: 'Pixel ratio',
      options: [
        { label: '1x', value: '1' },
        { label: '2x (retina)', value: '2' },
      ],
      type: 'select',
    },
  ],
  relatedToolIds: [
    'batch-image-tools',
    'image-tools',
    'web-pwa-icon-generator',
    'gif-frame-extractor',
  ],
  samples: [
    sample('Packed sheet, 2 px padding', {}),
    sample('Horizontal strip, no padding', { layout: 'horizontal', padding: '0' }),
    sample('Vertical strip, 4 px padding', { layout: 'vertical', padding: '4' }),
    sample('Grid with an icon prefix', { classPrefix: 'icon', layout: 'grid' }),
    sample('Retina sheet (2x)', { pixelRatio: '2' }),
    sample('Packed, wide padding', { classPrefix: 'ui', padding: '8' }),
  ],
  run: ({ fields }) => generate(fields),
};
