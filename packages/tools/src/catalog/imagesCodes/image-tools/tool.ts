import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { imageToPdf } from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import {
  browserSafeCapabilities,
  numberOrUndefined,
  replaceExtension,
  imageOptions,
  imageResult,
  fileExtension,
  SAMPLE_GPS_JPEG_DATA_URI,
  SAMPLE_PNG_DATA_URI,
} from '../shared';
import { imageToolsFields } from './fields';

export const imageToolsTool: ToolDefinition = {
  id: 'image-tools',
  preview: 'image',
  keywords: ['resize', 'crop', 'convert', 'compress', 'watermark', 'jpeg', 'png', 'webp'],
  name: 'Image Tools',
  category: 'Images & Codes',
  description: 'Resize, crop, convert, filter, watermark, inspect and export a local image.',
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save', 'copy', 'scratch'],
  fields: imageToolsFields,
  relatedToolIds: [
    'batch-image-tools',
    'exif-remover',
    'pixel-diff',
    'color-converter',
    'gif-frame-extractor',
  ],
  samples: [
    {
      fields: { image: SAMPLE_PNG_DATA_URI, operation: 'metadata' },
      label: 'Inspect metadata & dimensions',
    },
    {
      fields: {
        compression: 'balanced',
        format: 'webp',
        image: SAMPLE_GPS_JPEG_DATA_URI,
        imageName: 'IMG_2041.jpg',
        operation: 'compress',
      },
      label: 'Compress a JPEG photo to WebP (balanced)',
    },
    {
      fields: {
        format: 'png',
        height: '',
        image: SAMPLE_PNG_DATA_URI,
        keepAspect: 'true',
        operation: 'transform',
        width: '16',
      },
      label: 'Resize to 16 px wide',
    },
    {
      fields: { image: SAMPLE_PNG_DATA_URI, operation: 'grayscale' },
      label: 'Convert to grayscale',
    },
    {
      fields: {
        format: 'webp',
        image: SAMPLE_PNG_DATA_URI,
        operation: 'transform',
        quality: '85',
      },
      label: 'Export to WebP (quality 85%)',
    },
    {
      fields: { angle: '90', image: SAMPLE_PNG_DATA_URI, operation: 'rotate' },
      label: 'Rotate 90 degrees clockwise',
    },
    {
      fields: {
        contrast: '1.2',
        image: SAMPLE_PNG_DATA_URI,
        operation: 'filters',
        sepia: 'true',
      },
      label: 'Color filter (sepia & contrast)',
    },
    {
      fields: {
        annotationFontSize: '10',
        annotations: 'label 2 2 Note\nrect 2 20 28 10\nredact 4 22 12 4',
        image: SAMPLE_PNG_DATA_URI,
        operation: 'annotate',
      },
      label: 'Annotate (label, box & redaction)',
    },
    {
      fields: {
        colorBlindnessMode: 'deuteranopia',
        image: SAMPLE_PNG_DATA_URI,
        operation: 'color-blindness',
      },
      label: 'Color blindness - deuteranopia',
    },
  ],
  run: ({ fields }) => processImage(fields),
};

interface ImageJob {
  fields: Record<string, string>;
  name: string;
  operation: string;
  source: ReturnType<typeof fileBytesFromField>;
}

async function processImage(fields: Record<string, string>): Promise<ToolResult> {
  const job: ImageJob = {
    fields,
    name: fields.imageName || 'image',
    operation: fields.operation || 'transform',
    source: fileBytesFromField(fields.image, 'Image file'),
  };
  const { name, operation, source } = job;

  if (operation === 'metadata' || operation === 'format') return inspectImageResult(job);

  if (operation === 'base64') {
    const dataUri = dataUriFromBytes(source.bytes, source.mimeType);

    return {
      text: fields.base64Mode === 'base64' ? dataUri.slice(dataUri.indexOf(',') + 1) : dataUri,
      language: 'plaintext',
    };
  }

  if (operation === 'ascii') return asciiResult(job);
  if (operation === 'dominant-color') return dominantColorResult(job);
  if (operation === 'color-picker') return colorResult(job);
  if (operation === 'pdf') return pdfResult(job);
  if (operation === 'compress') return compressResult(job);

  const result = await withToolErrorAsync(() =>
    imageFunctions.transformImage({ name, ...source }, imageOptions(fields, operation)),
  );

  return imageResult(
    result.bytes,
    result.mimeType,
    replaceExtension(name, fileExtension(result.extension)),
    `${operation} complete. ${result.width} × ${result.height} px. ${sizeChange(source.bytes.length, result.bytes.length)}`,
  );
}

async function inspectImageResult({ name, source }: ImageJob): Promise<ToolResult> {
  const report = await withToolErrorAsync(() => imageFunctions.inspectImage({ name, ...source }));

  return {
    text: JSON.stringify(report, null, 2),
    language: 'json',
    resultActions: ['copy', 'scratch'],
    summary: `Image metadata · ${report.file.width} × ${report.file.height} · ${report.mimeType}`,
  };
}

async function asciiResult({ fields, name, source }: ImageJob): Promise<ToolResult> {
  const options = {
    width: numberOrUndefined(fields.asciiWidth),
    density: (fields.asciiDensity || 'standard') as 'standard' | 'dense' | 'blocks',
    invert: fields.asciiInvert === 'true',
  };

  return {
    text: await withToolErrorAsync(() => imageFunctions.imageToAscii({ name, ...source }, options)),
    resultActions: ['copy', 'scratch'],
  };
}

async function dominantColorResult({ name, source }: ImageJob): Promise<ToolResult> {
  const palette = await withToolErrorAsync(() =>
    imageFunctions.dominantImageColors({ name, ...source }),
  );

  return {
    text: JSON.stringify({ hex: palette[0]?.hex, palette }, null, 2),
    language: 'json',
  };
}

async function colorResult({ fields, name, source }: ImageJob): Promise<ToolResult> {
  const color = await withToolErrorAsync(() =>
    imageFunctions.sampleImageColor(
      { name, ...source },
      numberOrUndefined(fields.colorX),
      numberOrUndefined(fields.colorY),
    ),
  );
  const report = { ...color, css: { rgb: `rgb(${color.rgb.r} ${color.rgb.g} ${color.rgb.b})` } };

  return { text: JSON.stringify(report, null, 2), language: 'json' };
}

async function pdfResult({ name, source }: ImageJob): Promise<ToolResult> {
  const png = await withToolErrorAsync(() =>
    imageFunctions.transformImage({ name, ...source }, { format: 'png', quality: 100 }),
  );

  return {
    text: 'Image PDF generated.',
    artifact: {
      base64: base64Encode(await imageToPdf(png.bytes)),
      mimeType: 'application/pdf',
      fileName: replaceExtension(name, 'pdf'),
    },
  };
}

async function compressResult({ fields, name, operation, source }: ImageJob): Promise<ToolResult> {
  const quality =
    fields.compression === 'custom'
      ? numberOrUndefined(fields.quality)
      : compressionQuality[fields.compression || 'balanced'];

  if (quality === undefined)
    throw new ToolError('Choose High quality, Balanced, Smallest or Custom compression.');

  const result = await withToolErrorAsync(() =>
    imageFunctions.transformImage(
      { name, ...source },
      { format: imageOptions(fields, operation).format, operation: 'transform', quality },
    ),
  );
  const lossless =
    result.extension === 'png' ? ' PNG is lossless; choose JPEG or WebP for a smaller file.' : '';

  return imageResult(
    result.bytes,
    result.mimeType,
    replaceExtension(name, fileExtension(result.extension)),
    `Compressed at quality ${quality}. ${sizeChange(source.bytes.length, result.bytes.length)}${lossless}`,
  );
}

const compressionQuality: Record<string, number> = { balanced: 75, high: 90, small: 55 };

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function sizeChange(before: number, after: number): string {
  const change = before ? Math.round((Math.abs(after - before) / before) * 100) : 0;

  return `${fileSize(before)} → ${fileSize(after)}, ${sizeVerdict(change, after < before)}.`;
}

function sizeVerdict(percentChange: number, smaller: boolean): string {
  if (percentChange === 0) return 'about the same size';

  return smaller ? `${percentChange}% smaller` : `${percentChange}% larger`;
}
