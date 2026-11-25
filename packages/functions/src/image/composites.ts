import { parsePrintedCssColor } from '../color/cssColor';
import { context2d, createCanvas, decodeImage, encodeCanvas } from './canvas';
import { clampInteger, mimeForExtension, normalizedQuality } from './formats';
import type { EncodedImage, ImageFile } from './types';

export async function createContactSheet(files: ImageFile[]): Promise<Uint8Array> {
  const thumbs = await Promise.all(
    files.slice(0, 12).map((file) => decodeImage(file.bytes, file.mimeType)),
  );
  const cell = 180;
  const columns = Math.min(4, thumbs.length || 1);
  const rows = Math.ceil(thumbs.length / columns);
  const canvas = createCanvas(columns * cell, rows * cell);
  const context = context2d(canvas);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  thumbs.forEach((bitmap, index) => {
    const scale = Math.min((cell - 20) / bitmap.width, (cell - 20) / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;

    context.drawImage(
      bitmap,
      (index % columns) * cell + (cell - width) / 2,
      Math.floor(index / columns) * cell + (cell - height) / 2,
      width,
      height,
    );
  });

  return encodeCanvas(canvas, 'jpeg', 0.85);
}

function collageColumns(
  layout: '2x2' | '3x3' | 'horizontal-strip' | 'vertical-strip' | undefined,
  imageCount: number,
): number {
  if (layout === 'horizontal-strip') return imageCount;
  if (layout === 'vertical-strip') return 1;
  if (layout === '3x3') return 3;

  return 2;
}

export async function createCollage(
  files: ImageFile[],
  options: {
    background?: string;
    format?: 'png' | 'jpeg';
    gap?: number;
    layout?: '2x2' | '3x3' | 'horizontal-strip' | 'vertical-strip';
    quality?: number;
  } = {},
): Promise<EncodedImage> {
  // A canvas ignores an invalid fillStyle and would paint black.
  if (options.background) parsePrintedCssColor(options.background);

  const bitmaps = await Promise.all(files.map((file) => decodeImage(file.bytes, file.mimeType)));
  const gap = clampInteger(options.gap ?? 12, 0, 200);
  const slot = 320;
  const columns = collageColumns(options.layout, bitmaps.length);
  const rows = Math.ceil(bitmaps.length / columns);
  const canvas = createCanvas(
    columns * slot + Math.max(0, columns - 1) * gap,
    rows * slot + Math.max(0, rows - 1) * gap,
  );
  const context = context2d(canvas);

  context.fillStyle = options.background || '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  bitmaps.forEach((bitmap, index) => {
    const scale = Math.min(slot / bitmap.width, slot / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;

    context.drawImage(
      bitmap,
      (index % columns) * (slot + gap) + (slot - width) / 2,
      Math.floor(index / columns) * (slot + gap) + (slot - height) / 2,
      width,
      height,
    );
  });

  const extension = options.format ?? 'jpeg';

  return {
    bytes: await encodeCanvas(canvas, extension, normalizedQuality(options.quality)),
    mimeType: mimeForExtension(extension),
    extension,
  };
}
