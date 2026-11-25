import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  assertZipLimit,
  decodeHeic,
  encodeHeicImage,
  type ImageFormat,
} from '@devtoolora/functions/image';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import { withToolErrorAsync } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { filesFromField, type ToolFile, zipArtifact } from '../../../adapters/files';
import { browserSafeCapabilities, fileExtension } from '../shared';
import { CORNERS_DATA_URI, MULTI_DATA_URI, ROTATED_DATA_URI } from './sample';

const MIB = 1_048_576;
const MAX_FILES = 50;
const MAX_FILE_BYTES = 50 * MIB;
const MAX_TOTAL_BYTES = 200 * MIB;
const formats = ['jpeg', 'png', 'webp'] as const;
const imageModes = ['primary', 'all'] as const;
const formatLabels: Record<ImageFormat, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };

type Output = { bytes: Uint8Array; name: string };
type Failure = { message: string; name: string };

/** Sizes come from the base64 length so nothing is decoded before the limits are checked. */
function checkLimits(value: string | undefined): void {
  let entries: Array<{ data?: string }> = [];

  try {
    entries = JSON.parse(value ?? '[]') as Array<{ data?: string }>;
  } catch {
    return;
  }

  if (entries.length > MAX_FILES) throw new ToolError(`Select at most ${MAX_FILES} files.`);

  let total = 0;

  for (const entry of entries) {
    const size = Math.floor(((entry.data?.length ?? 0) - (entry.data?.indexOf(',') ?? 0)) * 0.75);

    if (size > MAX_FILE_BYTES) throw new ToolError('Each file may be at most 50 MiB.');

    total += size;
  }

  if (total > MAX_TOTAL_BYTES) throw new ToolError('The files may be at most 200 MiB in total.');
}

function uniqueName(stem: string, extension: string, used: Set<string>): string {
  let name = `${stem}.${extension}`;

  for (let counter = 2; used.has(name.toLowerCase()); counter += 1)
    name = `${stem}-${counter}.${extension}`;

  used.add(name.toLowerCase());

  return name;
}

export async function processBatchImages(
  files: ToolFile[],
  options: { format: ImageFormat; images: 'all' | 'primary'; quality: number; zipLimit?: number },
): Promise<{ failed: Failure[]; outputs: Output[]; succeeded: number }> {
  const outputs: Output[] = [];
  const failed: Failure[] = [];
  const used = new Set<string>();
  let succeeded = 0;
  let totalBytes = 0;

  for (const file of files) {
    const fileNames: string[] = [];

    try {
      const decoded = await withToolErrorAsync(() => decodeHeic(file.bytes, options.images));
      const stem = file.name.replace(/\.[^.]*$/, '') || 'image';
      const encoded: Output[] = [];

      for (const image of decoded) {
        const bytes = await encodeHeicImage(image, options.format, options.quality);

        totalBytes += bytes.length;
        await withToolErrorAsync(async () => assertZipLimit(totalBytes, options.zipLimit));

        const name = uniqueName(stem, fileExtension(options.format), used);

        fileNames.push(name.toLowerCase());
        encoded.push({ bytes, name });
      }

      outputs.push(...encoded);
      succeeded += 1;
    } catch (error) {
      for (const name of fileNames) used.delete(name);

      if (error instanceof ToolError && /zip limit/.test(error.message)) throw error;

      failed.push({ message: (error as Error).message, name: file.name });
    }
  }

  return { failed, outputs, succeeded };
}

async function convert(fields: Record<string, string>): Promise<ToolResult> {
  checkLimits(fields.files);

  const files = filesFromField(fields.files, 'HEIC files');
  const format = choiceField(fields.format, 'jpeg', formats, 'Format must be jpeg, png or webp.');
  const images = choiceField(
    fields.images,
    'primary',
    imageModes,
    'Images must be primary or all.',
  );
  const quality = Math.min(100, Math.max(1, Number(fields.quality) || 90));
  const { failed, outputs, succeeded } = await processBatchImages(files, {
    format,
    images,
    quality,
  });

  if (outputs.length === 0)
    throw new ToolError(
      `No image could be converted. ${failed[0]?.name ?? ''}: ${failed[0]?.message ?? ''}`,
    );

  const summary = `Converted ${outputs.length} ${outputs.length === 1 ? 'image' : 'images'} to ${formatLabels[format]}${failed.length ? `; ${failed.length} failed` : ''}. EXIF and GPS metadata were not copied.`;
  const batch = { failed, succeeded, total: files.length };

  if (outputs.length === 1) {
    const [only] = outputs as [Output];
    const mimeType = `image/${format}`;

    return {
      artifact: { base64: base64Encode(only.bytes), fileName: only.name, mimeType },
      batch,
      previewDataUri: dataUriFromBytes(only.bytes, mimeType),
      summary,
      text: summary,
    };
  }

  const stem = files[0]?.name.replace(/\.[^.]*$/, '') || 'image';
  const zipName = files.length === 1 ? `${stem}-heic.zip` : 'heic-converted.zip';

  return { artifact: zipArtifact(outputs, zipName), batch, summary, text: summary };
}

const sample = (
  label: string,
  files: Array<[string, string]>,
  options: { format?: string; images?: string; quality?: string } = {},
) => ({
  fields: {
    files: JSON.stringify(files.map(([name, data]) => ({ data, name }))),
    format: 'jpeg',
    images: 'primary',
    quality: '90',
    ...options,
  },
  label,
});

const samples = (format: string) => [
  sample('One file', [['IMG_0001.heic', CORNERS_DATA_URI]], { format }),
  sample('To PNG', [['photo.heic', CORNERS_DATA_URI]], { format: 'png' }),
  sample('To WebP, quality 70', [['photo.heic', CORNERS_DATA_URI]], {
    format: 'webp',
    quality: '70',
  }),
  sample('Rotated photo', [['portrait.heic', ROTATED_DATA_URI]], { format }),
  sample('Every image of a file', [['multi.heic', MULTI_DATA_URI]], { format, images: 'all' }),
  sample(
    'Two files',
    [
      ['IMG_0001.heic', CORNERS_DATA_URI],
      ['IMG_0002.heic', ROTATED_DATA_URI],
    ],
    { format },
  ),
];

export const heicConverterTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Convert iPhone HEIC and HEIF photos to JPEG, PNG or WebP with a decoder that runs in your browser.',
  fields: [
    {
      accept: '.heic,.heif,image/heic,image/heif',
      id: 'files',
      label: 'HEIC files',
      maxBytes: MAX_FILE_BYTES,
      multiple: true,
      required: true,
      type: 'file',
    },
    {
      defaultValue: 'jpeg',
      id: 'format',
      label: 'Output format',
      options: [
        { label: 'JPEG', value: 'jpeg' },
        { label: 'PNG', value: 'png' },
        { label: 'WebP', value: 'webp' },
      ],
      type: 'select',
    },
    {
      defaultValue: '90',
      id: 'quality',
      label: 'Quality',
      range: { max: 100, min: 1 },
      type: 'number',
      visibleWhen: { field: 'format', is: ['jpeg', 'webp'] },
    },
    {
      defaultValue: 'primary',
      id: 'images',
      label: 'Images per file',
      options: [
        { label: 'Primary image only', value: 'primary' },
        { label: 'All images', value: 'all' },
      ],
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'heic-converter',
  inputKind: 'none',
  keywords: ['heic', 'heif', 'iphone', 'jpg', 'jpeg', 'png', 'webp', 'convert', 'photo'],
  name: 'HEIC to JPG & PNG',
  outputKind: 'text',
  relatedToolIds: ['image-tools', 'batch-image-tools', 'image-ocr'],
  resultActions: ['save'],
  run: ({ fields }) => convert(fields),
  runRequires: [{ anyOf: ['files'] }],
  runtime: 'heic',
  samples: samples('jpeg'),
  supportsSelection: false,
};

function aliasOf(id: string, name: string, format: string, description: string): ToolDefinition {
  return {
    ...heicConverterTool,
    aliasOf: 'heic-converter',
    description,
    fields: (heicConverterTool.fields ?? []).map((field) =>
      field.id === 'format' ? { ...field, defaultValue: format } : field,
    ),
    id,
    name,
    samples: samples(format),
  };
}

export const heicToJpgTool = aliasOf(
  'heic-to-jpg',
  'HEIC to JPG',
  'jpeg',
  'Turn iPhone HEIC photos into JPG files, locally in your browser.',
);

export const heicToPngTool = aliasOf(
  'heic-to-png',
  'HEIC to PNG',
  'png',
  'Turn iPhone HEIC photos into lossless PNG files, locally in your browser.',
);
