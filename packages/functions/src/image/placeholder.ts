import { parsePrintedCssColor } from '../color/cssColor';
import { context2d, createCanvas, encodeCanvas } from './canvas';
import { imageError } from './formats';
import type { EncodedImage } from './types';

const maxPixels = 16_777_216;

export type RasterPlaceholderOptions = {
  background: string;
  foreground: string;
  format: 'jpeg' | 'png';
  height: number;
  label: string;
  quality: number;
  width: number;
};

export function checkPlaceholderColors(background: string, foreground: string): void {
  parsePrintedCssColor(background);
  parsePrintedCssColor(foreground);
}

export async function createRasterPlaceholder(
  options: RasterPlaceholderOptions,
): Promise<EncodedImage> {
  const { height, width } = options;

  checkPlaceholderColors(options.background, options.foreground);

  if (width * height > maxPixels)
    throw imageError('Raster placeholders are limited to 16,777,216 pixels (4,096 × 4,096).');

  const canvas = createCanvas(width, height);
  const context = context2d(canvas);

  context.fillStyle = options.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = options.foreground;
  context.font = `${Math.max(16, Math.round(width / 14))}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(options.label, width / 2, height / 2);

  const extension = options.format;
  const bytes = await encodeCanvas(canvas, extension, options.quality / 100);

  return { bytes, extension, mimeType: extension === 'png' ? 'image/png' : 'image/jpeg' };
}
