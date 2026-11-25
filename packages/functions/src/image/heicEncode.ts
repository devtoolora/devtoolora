import { FunctionError } from '../errors';
import { context2d, createCanvas, encodeCanvas, flattenOnWhite } from './canvas';
import type { DecodedHeicImage } from './heic';
import type { ImageFormat } from './types';

const MAX_ZIP_BYTES = 500 * 1_048_576;

export function assertZipLimit(totalBytes: number, limit = MAX_ZIP_BYTES): void {
  if (totalBytes > limit)
    throw new FunctionError('HEIC', 'The converted images exceed the 500 MiB zip limit.');
}

export async function encodeHeicImage(
  image: DecodedHeicImage,
  format: ImageFormat,
  quality: number,
): Promise<Uint8Array> {
  const canvas = createCanvas(image.width, image.height);
  const context = context2d(canvas);
  const pixels = context.createImageData(image.width, image.height);

  pixels.data.set(image.data);
  context.putImageData(pixels, 0, 0);

  return encodeCanvas(format === 'jpeg' ? flattenOnWhite(canvas) : canvas, format, quality / 100);
}
