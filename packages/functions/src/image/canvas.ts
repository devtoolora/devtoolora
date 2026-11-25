import { imageError, mimeForExtension } from './formats';
import type { ImageFormat } from './types';

export async function decodeImage(bytes: Uint8Array, mimeType: string): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function')
    throw imageError('Image tools require browser image APIs.');

  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return createImageBitmap(new Blob([buffer], { type: mimeType }));
}

const maxCanvasSide = 32_767;
const maxCanvasPixels = 268_435_456;

export function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  // Over the limit a browser returns an unusable canvas and only the later export fails, vaguely.
  if (width > maxCanvasSide || height > maxCanvasSide || width * height > maxCanvasPixels)
    throw imageError(
      `The output would be ${width.toLocaleString('en-US')} × ${height.toLocaleString('en-US')} px, over the browser limit of ${maxCanvasSide.toLocaleString('en-US')} px per side and ${maxCanvasPixels.toLocaleString('en-US')} pixels. Use a smaller size.`,
    );

  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  throw imageError('Image tools require browser canvas APIs.');
}

export function context2d(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const context = canvas.getContext('2d') as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (!context) throw imageError('Could not create a 2D canvas context.');

  return context;
}

export function drawImageToCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  const canvas = createCanvas(width, height);

  context2d(canvas).drawImage(bitmap, 0, 0, width, height);

  return canvas;
}

export async function encodeCanvas(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  extension: ImageFormat,
  quality: number,
): Promise<Uint8Array> {
  const mimeType = mimeForExtension(extension);

  if ('convertToBlob' in canvas)
    return new Uint8Array(
      await (await canvas.convertToBlob({ type: mimeType, quality })).arrayBuffer(),
    );

  const blob = await new Promise<Blob>((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob(
      (value) => (value ? resolve(value) : reject(imageError('Could not encode image.'))),
      mimeType,
      quality,
    ),
  );

  return new Uint8Array(await blob.arrayBuffer());
}

export function imageDataFromBitmap(bitmap: ImageBitmap): ImageData {
  return context2d(drawImageToCanvas(bitmap, bitmap.width, bitmap.height)).getImageData(
    0,
    0,
    bitmap.width,
    bitmap.height,
  );
}

export function flattenOnWhite(
  source: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvas | HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height);
  const context = context2d(canvas);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0);

  return canvas;
}

export function hasTransparentPixels(bitmap: ImageBitmap): boolean {
  const { data } = imageDataFromBitmap(bitmap);

  for (let index = 3; index < data.length; index += 4) if (data[index]! < 255) return true;

  return false;
}
