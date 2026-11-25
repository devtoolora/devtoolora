import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { filesFromField, zipArtifact } from '../../../adapters/files';
import {
  browserSafeCapabilities,
  numberOrUndefined,
  imageResult,
  imageOptions,
  fileExtension,
  SAMPLE_BLUE_PNG_DATA_URI,
  SAMPLE_PNG_DATA_URI,
  SAMPLE_RED_PNG_DATA_URI,
} from '../shared';
import { socialImagePresets } from './presets';

const presetIds = ['custom', ...socialImagePresets.map((preset) => preset.id)];
const customSize = [
  { field: 'mode', is: ['batch'] },
  { field: 'preset', is: ['custom'] },
];

export const batchImageToolsTool: ToolDefinition = {
  id: 'batch-image-tools',
  keywords: [
    'bulk resize',
    'batch convert',
    'compress images',
    'rename',
    'collage',
    'contact sheet',
  ],
  name: 'Batch Image Tools',
  category: 'Images & Codes',
  description: 'Convert, resize, compress, rename, collage and contact-sheet local images.',
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save'],
  fields: [
    {
      id: 'mode',
      label: 'Mode',
      type: 'select',
      defaultValue: 'batch',
      options: [
        { label: 'Batch archive', value: 'batch' },
        { label: 'Collage', value: 'collage' },
      ],
    },
    {
      id: 'images',
      label: 'Image files',
      required: true,
      type: 'file',
      accept: 'image/*',
      multiple: true,
    },
    {
      id: 'format',
      label: 'Export format',
      type: 'select',
      defaultValue: 'webp',
      options: [
        { label: 'WebP', value: 'webp' },
        { label: 'PNG', value: 'png' },
        { label: 'JPEG', value: 'jpeg' },
      ],
      visibleWhen: { field: 'mode', is: ['batch'] },
    },
    {
      id: 'preset',
      label: 'Size preset',
      type: 'select',
      defaultValue: 'custom',
      options: [
        { label: 'Custom size', value: 'custom' },
        ...socialImagePresets.map((preset) => ({
          label: `${preset.label} (${preset.width}×${preset.height})`,
          value: preset.id,
        })),
      ],
      visibleWhen: { field: 'mode', is: ['batch'] },
    },
    {
      id: 'width',
      label: 'Max width',
      type: 'number',
      placeholder: 'optional',
      visibleWhen: customSize,
    },
    {
      id: 'height',
      label: 'Max height',
      type: 'number',
      placeholder: 'optional',
      visibleWhen: customSize,
    },
    {
      id: 'crop',
      label: 'Center crop to dimensions',
      type: 'checkbox',
      defaultValue: 'false',
      visibleWhen: customSize,
    },
    { id: 'quality', label: 'Quality', type: 'number', defaultValue: '82' },
    {
      id: 'prefix',
      label: 'Rename prefix',
      type: 'text',
      defaultValue: 'image',
      visibleWhen: customSize,
    },
    {
      id: 'contactSheet',
      label: 'Include contact sheet',
      type: 'checkbox',
      defaultValue: 'true',
      visibleWhen: { field: 'mode', is: ['batch'] },
    },
    {
      id: 'collageLayout',
      label: 'Collage layout',
      type: 'select',
      defaultValue: '2x2',
      options: [
        { label: '2x2', value: '2x2' },
        { label: '3x3', value: '3x3' },
        { label: 'Horizontal strip', value: 'horizontal-strip' },
        { label: 'Vertical strip', value: 'vertical-strip' },
      ],
      visibleWhen: { field: 'mode', is: ['collage'] },
    },
    {
      id: 'collageFormat',
      label: 'Collage format',
      type: 'select',
      defaultValue: 'jpeg',
      options: [
        { label: 'JPEG', value: 'jpeg' },
        { label: 'PNG', value: 'png' },
      ],
      visibleWhen: { field: 'mode', is: ['collage'] },
    },
    {
      id: 'collageGap',
      label: 'Gap',
      type: 'number',
      defaultValue: '12',
      visibleWhen: { field: 'mode', is: ['collage'] },
    },
    {
      id: 'collageBackground',
      label: 'Background color',
      type: 'text',
      defaultValue: '#ffffff',
      visibleWhen: { field: 'mode', is: ['collage'] },
    },
  ],
  relatedToolIds: ['image-tools', 'exif-remover', 'pixel-diff'],
  samples: [
    {
      fields: {
        format: 'webp',
        images: JSON.stringify([{ data: SAMPLE_PNG_DATA_URI, name: 'sample1.png' }]),
        mode: 'batch',
        prefix: 'optimized',
      },
      label: 'Batch convert to WebP',
    },
    {
      fields: {
        collageFormat: 'jpeg',
        collageLayout: '2x2',
        images: JSON.stringify([
          { data: SAMPLE_PNG_DATA_URI, name: 'a.png' },
          { data: SAMPLE_RED_PNG_DATA_URI, name: 'b.png' },
        ]),
        mode: 'collage',
      },
      label: '2x2 grid collage (JPEG)',
    },
    {
      fields: {
        collageFormat: 'png',
        collageLayout: '3x3',
        images: JSON.stringify([
          { data: SAMPLE_PNG_DATA_URI, name: '1.png' },
          { data: SAMPLE_BLUE_PNG_DATA_URI, name: '2.png' },
          { data: SAMPLE_RED_PNG_DATA_URI, name: '3.png' },
        ]),
        mode: 'collage',
      },
      label: '3x3 grid collage (PNG)',
    },
    {
      fields: {
        collageFormat: 'png',
        collageGap: '8',
        collageLayout: 'horizontal-strip',
        images: JSON.stringify([
          { data: SAMPLE_PNG_DATA_URI, name: 'left.png' },
          { data: SAMPLE_BLUE_PNG_DATA_URI, name: 'right.png' },
        ]),
        mode: 'collage',
      },
      label: 'Horizontal strip collage',
    },
    {
      fields: {
        collageFormat: 'jpeg',
        collageGap: '16',
        collageLayout: 'vertical-strip',
        images: JSON.stringify([
          { data: SAMPLE_PNG_DATA_URI, name: 'top.png' },
          { data: SAMPLE_RED_PNG_DATA_URI, name: 'bottom.png' },
        ]),
        mode: 'collage',
      },
      label: 'Vertical strip collage',
    },
    {
      fields: {
        contactSheet: 'true',
        format: 'png',
        height: '64',
        images: JSON.stringify([
          { data: SAMPLE_PNG_DATA_URI, name: 'img1.png' },
          { data: SAMPLE_BLUE_PNG_DATA_URI, name: 'img2.png' },
        ]),
        mode: 'batch',
        prefix: 'thumb',
        width: '64',
      },
      label: 'Batch resize with contact sheet',
    },
  ],
  run: ({ fields }) => processBatchImages(fields),
};

function noImageError(failure: { message: string; name: string } | undefined): ToolError {
  return new ToolError(
    failure
      ? `No image could be processed. ${failure.name}: ${failure.message}`
      : 'No image could be processed.',
  );
}

type SocialPreset = (typeof socialImagePresets)[number];

function selectedPreset(value: string | undefined): SocialPreset | undefined {
  const id = choiceField(value, 'custom', presetIds, 'Size preset is not a known preset.');

  return socialImagePresets.find((entry) => entry.id === id);
}

function batchOptions(
  fields: Record<string, string>,
  preset: SocialPreset | undefined,
): imageFunctions.ImageTransformOptions {
  const options = imageOptions(fields, 'transform');

  return {
    ...options,
    keepAspect: !(options.width && options.height),
    crop: { mode: preset || fields.crop === 'true' ? 'cover' : 'none' },
    ...(preset && { height: preset.height, width: preset.width }),
  };
}

function outputName(
  sourceName: string,
  index: number,
  extension: string,
  prefix: string | undefined,
  preset: SocialPreset | undefined,
  usedNames: Set<string>,
): string {
  if (!preset) return `${prefix || 'image'}-${String(index + 1).padStart(3, '0')}.${extension}`;

  const stem = `${sourceName.replace(/\.[^.]+$/, '')}-${preset.width}x${preset.height}`;
  const name = usedNames.has(stem) ? `${stem}-${index + 1}` : stem;

  usedNames.add(stem);

  return `${name}.${extension}`;
}

async function processBatchImages(fields: Record<string, string>): Promise<ToolResult> {
  const files = filesFromField(fields.images, 'Image files');
  const mode = fields.mode || 'batch';

  if (mode === 'collage') {
    const result = await withToolErrorAsync(() =>
      imageFunctions.createCollage(files, {
        layout: (fields.collageLayout || '2x2') as
          '2x2' | '3x3' | 'horizontal-strip' | 'vertical-strip',
        gap: numberOrUndefined(fields.collageGap),
        background: fields.collageBackground,
        format: fields.collageFormat === 'png' ? 'png' : 'jpeg',
        quality: numberOrUndefined(fields.quality),
      }),
    );
    const format = fields.collageFormat === 'png' ? 'png' : 'jpeg';

    return imageResult(
      result.bytes,
      result.mimeType,
      `collage.${format === 'jpeg' ? 'jpg' : 'png'}`,
      'Collage generated.',
    );
  }

  const outputs: Array<{ bytes: Uint8Array; name: string }> = [];
  const processed: typeof files = [];
  const failed: Array<{ message: string; name: string }> = [];
  const preset = selectedPreset(fields.preset);
  const options = batchOptions(fields, preset);
  const usedNames = new Set<string>();

  for (const [index, file] of files.entries()) {
    try {
      const result = await imageFunctions.transformImage(file, options);

      const extension = fileExtension(result.extension);
      const name = outputName(file.name, index, extension, fields.prefix, preset, usedNames);

      outputs.push({ name, bytes: result.bytes });

      processed.push(file);
    } catch (error) {
      failed.push({ name: file.name, message: (error as Error).message });
    }
  }

  if (processed.length === 0) throw noImageError(failed[0]);

  if (fields.contactSheet !== 'false') {
    outputs.push({
      name: 'contact-sheet.jpg',
      bytes: await imageFunctions.createContactSheet(processed),
    });
  }

  const count =
    processed.length === files.length
      ? `${processed.length}`
      : `${processed.length} of ${files.length}`;
  const text = `Processed ${count} ${files.length === 1 ? 'image' : 'images'}${failed.length ? `; ${failed.length} failed` : ''}.`;

  return {
    text,
    artifact: zipArtifact(outputs, 'images.zip'),
    batch: { total: files.length, succeeded: processed.length, failed },
  };
}

const aliasDefaults: Record<string, string> = {
  contactSheet: 'false',
  format: 'jpeg',
  preset: 'instagram-square',
  quality: '85',
};

function aliasSample(label: string, preset: string, names: string[], format = 'jpeg') {
  const fixtures = [SAMPLE_PNG_DATA_URI, SAMPLE_BLUE_PNG_DATA_URI, SAMPLE_RED_PNG_DATA_URI];

  return {
    fields: {
      format,
      images: JSON.stringify(
        names.map((name, index) => ({ data: fixtures[index % fixtures.length], name })),
      ),
      mode: 'batch',
      preset,
    },
    label,
  };
}

export const socialMediaImageResizerTool: ToolDefinition = {
  ...batchImageToolsTool,
  aliasOf: 'batch-image-tools',
  description:
    'Resize and crop local images to Instagram, X, LinkedIn, YouTube and Pinterest sizes.',
  fields: (batchImageToolsTool.fields ?? []).map((field) =>
    Object.hasOwn(aliasDefaults, field.id)
      ? { ...field, defaultValue: aliasDefaults[field.id] }
      : field,
  ),
  id: 'social-media-image-resizer',
  name: 'Social Media Image Resizer',
  samples: [
    aliasSample('Instagram Square (1080×1080)', 'instagram-square', ['post.png']),
    aliasSample('Instagram Story (1080×1920)', 'instagram-story', ['story.png']),
    aliasSample('Open Graph Preview (1200×630)', 'open-graph', ['cover.png', 'banner.png']),
    aliasSample('X Header (1500×500)', 'x-header', ['header.png'], 'png'),
    aliasSample('YouTube Thumbnail (1280×720)', 'youtube-thumbnail', ['thumb.png'], 'webp'),
    aliasSample('Pinterest Pin (1000×1500)', 'pinterest-pin', ['pin.png', 'pin.png']),
  ],
};
