import { parsePrintedCssColor } from '../color/cssColor';
import { drawAnnotations } from './annotate';
import { context2d, createCanvas, drawImageToCanvas } from './canvas';
import { clampInteger, imageError } from './formats';
import type { ImageTransformOptions } from './types';

type ImageCanvas = OffscreenCanvas | HTMLCanvasElement;
type ImageContext = ReturnType<typeof context2d>;

export async function transformBitmap(
  bitmap: ImageBitmap,
  options: ImageTransformOptions,
): Promise<ImageCanvas> {
  const operation = options.operation ?? 'transform';

  if (operation === 'rotate') return rotateBitmap(bitmap, options);

  const canvas = resizeBitmap(bitmap, operation === 'annotate' ? {} : options);
  const context = context2d(canvas);

  if (operation === 'flip') flipCanvas(canvas, context, bitmap, options);
  if (operation === 'grayscale') grayscaleCanvas(canvas, context);
  if (operation === 'color-blindness') simulateColorBlindness(canvas, context, options);
  if (operation === 'filters') filterCanvas(canvas, context, bitmap, options);
  if (operation === 'watermark') drawWatermark(canvas, context, options);
  if (operation === 'annotate' && options.annotate) drawAnnotations(context, options.annotate);

  return canvas;
}

function rotateBitmap(bitmap: ImageBitmap, options: ImageTransformOptions): ImageCanvas {
  const angle = (((options.angle ?? 90) % 360) + 360) % 360;
  const swap = angle === 90 || angle === 270;
  const canvas = createCanvas(
    swap ? bitmap.height : bitmap.width,
    swap ? bitmap.width : bitmap.height,
  );
  const context = context2d(canvas);

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((angle * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  return canvas;
}

function flipCanvas(
  canvas: ImageCanvas,
  context: ImageContext,
  bitmap: ImageBitmap,
  options: ImageTransformOptions,
): void {
  const copy = drawImageToCanvas(bitmap, bitmap.width, bitmap.height);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();

  if (options.flip === 'vertical') {
    context.scale(1, -1);
    context.drawImage(copy, 0, -canvas.height, canvas.width, canvas.height);
  } else {
    context.scale(-1, 1);
    context.drawImage(copy, -canvas.width, 0, canvas.width, canvas.height);
  }

  context.restore();
}

function grayscaleCanvas(canvas: ImageCanvas, context: ImageContext): void {
  const image = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < image.data.length; index += 4) {
    const gray = Math.round(
      (image.data[index] ?? 0) * 0.299 +
        (image.data[index + 1] ?? 0) * 0.587 +
        (image.data[index + 2] ?? 0) * 0.114,
    );

    image.data[index] = gray;
    image.data[index + 1] = gray;
    image.data[index + 2] = gray;
  }

  context.putImageData(image, 0, 0);
}

function simulateColorBlindness(
  canvas: ImageCanvas,
  context: ImageContext,
  options: ImageTransformOptions,
): void {
  const mode = options.colorBlindnessMode ?? 'deuteranopia';
  const image = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < image.data.length; index += 4) {
    const r = image.data[index] ?? 0;
    const g = image.data[index + 1] ?? 0;
    const b = image.data[index + 2] ?? 0;

    if (mode === 'achromatopsia') {
      const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

      image.data[index] = gray;
      image.data[index + 1] = gray;
      image.data[index + 2] = gray;
    } else if (mode === 'protanopia') {
      image.data[index] = Math.min(255, Math.round(0.56667 * r + 0.43333 * g));
      image.data[index + 1] = Math.min(255, Math.round(0.55833 * r + 0.44167 * g));
      image.data[index + 2] = Math.min(255, Math.round(0.24167 * g + 0.75833 * b));
    } else if (mode === 'tritanopia') {
      image.data[index] = Math.min(255, Math.round(0.95 * r + 0.05 * g));
      image.data[index + 1] = Math.min(255, Math.round(0.43333 * g + 0.56667 * b));
      image.data[index + 2] = Math.min(255, Math.round(0.475 * g + 0.525 * b));
    } else {
      image.data[index] = Math.min(255, Math.round(0.625 * r + 0.375 * g));
      image.data[index + 1] = Math.min(255, Math.round(0.7 * r + 0.3 * g));
      image.data[index + 2] = Math.min(255, Math.round(0.3 * g + 0.7 * b));
    }
  }

  context.putImageData(image, 0, 0);
}

function filterCanvas(
  canvas: ImageCanvas,
  context: ImageContext,
  bitmap: ImageBitmap,
  options: ImageTransformOptions,
): void {
  // A canvas silently drops the whole filter string when one value is invalid.
  if (
    Math.min(
      options.brightness ?? 1,
      options.contrast ?? 1,
      options.saturation ?? 1,
      options.blur ?? 0,
    ) < 0
  )
    throw imageError('Brightness, Contrast, Saturation and Blur radius cannot be negative.');

  const copy = drawImageToCanvas(bitmap, bitmap.width, bitmap.height);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = `brightness(${options.brightness ?? 1}) contrast(${options.contrast ?? 1}) saturate(${options.saturation ?? 1}) blur(${options.blur ?? 0}px)${options.sepia ? ' sepia(1)' : ''}${options.invert ? ' invert(1)' : ''}`;
  context.drawImage(copy, 0, 0, canvas.width, canvas.height);
}

function drawWatermark(
  canvas: ImageCanvas,
  context: ImageContext,
  options: ImageTransformOptions,
): void {
  const mark = options.watermark ?? {};

  // A canvas ignores an invalid fillStyle and would paint with the previous color.
  if (mark.color) parsePrintedCssColor(mark.color);

  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, mark.opacity ?? 0.35));
  context.fillStyle = mark.color || '#ffffff';
  context.font = `${clampInteger(mark.size ?? Math.max(16, Math.round(canvas.width / 12)), 8, 512)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let x = canvas.width / 2;
  let y = canvas.height / 2;

  if (mark.position === 'top-left') {
    x = canvas.width * 0.25;
    y = canvas.height * 0.25;
  } else if (mark.position === 'top-right') {
    x = canvas.width * 0.75;
    y = canvas.height * 0.25;
  } else if (mark.position === 'bottom-left') {
    x = canvas.width * 0.25;
    y = canvas.height * 0.75;
  } else if (mark.position === 'bottom-right') {
    x = canvas.width * 0.75;
    y = canvas.height * 0.75;
  }

  context.translate(x, y);
  context.rotate(((mark.rotation ?? -30) * Math.PI) / 180);
  context.fillText(mark.text || 'Watermark', 0, 0);
  context.restore();
}

function resizeBitmap(
  bitmap: ImageBitmap,
  options: ImageTransformOptions,
): OffscreenCanvas | HTMLCanvasElement {
  const { height: requestedHeight, width: requestedWidth } = options;

  if ((requestedWidth ?? 1) <= 0 || (requestedHeight ?? 1) <= 0)
    throw imageError('Width and Height must be greater than 0.');

  const crop = cropRect(bitmap, options.crop, requestedWidth, requestedHeight);
  let width = requestedWidth ?? crop.width;
  let height = requestedHeight ?? crop.height;
  const isCoverBox = options.crop?.mode === 'cover' && requestedWidth && requestedHeight;

  if (options.keepAspect !== false && !isCoverBox && (requestedWidth || requestedHeight)) {
    const scale = Math.min(
      (requestedWidth ?? Infinity) / crop.width,
      (requestedHeight ?? Infinity) / crop.height,
    );

    width = Math.max(1, Math.round(crop.width * scale));
    height = Math.max(1, Math.round(crop.height * scale));
  }

  const canvas = createCanvas(width, height);

  context2d(canvas).drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

  return canvas;
}

function cropAspectRatio(
  crop: ImageTransformOptions['crop'],
  targetWidth?: number,
  targetHeight?: number,
): number | undefined {
  if (crop?.mode === 'center') return 1;
  if (crop?.mode === 'cover' && targetWidth && targetHeight) return targetWidth / targetHeight;

  return undefined;
}

function cropRect(
  bitmap: ImageBitmap,
  crop: ImageTransformOptions['crop'],
  targetWidth?: number,
  targetHeight?: number,
): { height: number; width: number; x: number; y: number } {
  if (crop?.mode === 'custom') {
    if (!(crop.width && crop.width > 0) || !(crop.height && crop.height > 0))
      throw imageError('Custom crop requires crop width and height.');

    if ((crop.x ?? 0) >= bitmap.width || (crop.y ?? 0) >= bitmap.height)
      throw imageError(`Crop X and Y must be inside the ${bitmap.width} × ${bitmap.height} image.`);

    const x = clampInteger(crop.x ?? 0, 0, bitmap.width - 1);
    const y = clampInteger(crop.y ?? 0, 0, bitmap.height - 1);

    return {
      x,
      y,
      width: Math.max(1, Math.min(crop.width, bitmap.width - x)),
      height: Math.max(1, Math.min(crop.height, bitmap.height - y)),
    };
  }

  const ratio = cropAspectRatio(crop, targetWidth, targetHeight);

  if (ratio) {
    const width = Math.max(1, Math.min(bitmap.width, Math.round(bitmap.height * ratio)));
    const height = Math.max(1, Math.min(bitmap.height, Math.round(bitmap.width / ratio)));

    return {
      x: Math.round((bitmap.width - width) / 2),
      y: Math.round((bitmap.height - height) / 2),
      width,
      height,
    };
  }

  return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
}
