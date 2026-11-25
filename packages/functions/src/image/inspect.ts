import {
  decodeImage,
  drawImageToCanvas,
  encodeCanvas,
  flattenOnWhite,
  hasTransparentPixels,
} from './canvas';
import {
  aspectRatio,
  detectImageFormat,
  mayHaveAlpha,
  mimeExtension,
  mimeForExtension,
  normalizedQuality,
  pngChunkTypes,
  sourceFormat,
} from './formats';
import { loadExifr } from './loaders';
import { transformBitmap } from './transform';
import type {
  EncodedImage,
  ImageFile,
  ImageInspection,
  ImageTransformOptions,
  MetadataRemoval,
} from './types';

const pngMetadataChunks = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME', 'iCCP']);
/** IHDR fields exifr adds for every PNG; they describe the pixels, not metadata. */
const pngHeaderKeys = [
  'ImageWidth',
  'ImageHeight',
  'BitDepth',
  'ColorType',
  'Compression',
  'Filter',
  'Interlace',
];

export async function inspectImage(file: ImageFile): Promise<ImageInspection> {
  const bitmap = await decodeImage(file.bytes, file.mimeType);
  const detected = detectImageFormat(file.bytes) ?? {
    format: 'unknown',
    extension: '',
    mimeType: file.mimeType,
  };

  return {
    file: { name: file.name, width: bitmap.width, height: bitmap.height, mimeType: file.mimeType },
    aspectRatio: aspectRatio(bitmap.width, bitmap.height),
    megapixels: Number(((bitmap.width * bitmap.height) / 1_000_000).toFixed(3)),
    detectedFormat: detected.format,
    detectedExtension: detected.extension,
    mimeType: detected.mimeType,
    transparent: mayHaveAlpha(file.bytes, detected.format) && hasTransparentPixels(bitmap),
    pageCount: 1,
  };
}

export async function transformImage(
  file: ImageFile,
  options: ImageTransformOptions = {},
): Promise<EncodedImage & { height: number; width: number }> {
  const bitmap = await decodeImage(file.bytes, file.mimeType);
  const canvas = await transformBitmap(bitmap, options);
  const extension = options.format ?? sourceFormat(file);

  return {
    bytes: await encodeCanvas(canvas, extension, normalizedQuality(options.quality)),
    height: canvas.height,
    mimeType: mimeForExtension(extension),
    extension,
    width: canvas.width,
  };
}

/** EXIF dates have no zone and exifr reads them as local, so the local fields are the file's. */
function exifDateAsWritten(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function removeImageMetadata(file: ImageFile): Promise<MetadataRemoval> {
  const format = detectImageFormat(file.bytes)?.format ?? mimeExtension(file.mimeType);
  const parsed: Record<string, unknown> = {
    ...(await (await loadExifr()).default.parse(file.bytes).catch(() => undefined)),
  };
  const metadataChunks =
    format === 'png'
      ? pngChunkTypes(file.bytes).filter((type) => pngMetadataChunks.has(type))
      : undefined;

  if (format === 'png') pngHeaderKeys.forEach((key) => delete parsed[key]);

  for (const [key, value] of Object.entries(parsed))
    if (value instanceof Date) parsed[key] = exifDateAsWritten(value);

  const bitmap = await decodeImage(file.bytes, file.mimeType);
  const canvas = drawImageToCanvas(bitmap, bitmap.width, bitmap.height);
  let image: EncodedImage | undefined;

  if (format === 'png')
    image = {
      bytes: await encodeCanvas(canvas, 'png', 1),
      mimeType: 'image/png',
      extension: 'png',
    };

  if (format === 'webp') {
    const bytes = await encodeCanvas(canvas, 'webp', 0.9);

    if (detectImageFormat(bytes)?.format === 'webp')
      image = { bytes, mimeType: 'image/webp', extension: 'webp' };
  }

  image ??= {
    bytes: await encodeCanvas(flattenOnWhite(canvas), 'jpeg', 0.9),
    mimeType: 'image/jpeg',
    extension: 'jpeg',
  };

  return {
    metadata: parsed,
    metadataChunks,
    hasMetadata: Object.keys(parsed).length > 0 || (metadataChunks?.length ?? 0) > 0,
    image,
    width: bitmap.width,
    height: bitmap.height,
    webpFallback: format === 'webp' && image.extension === 'jpeg',
  };
}
