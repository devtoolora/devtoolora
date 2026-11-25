import {
  context2d,
  createCanvas,
  decodeImage,
  drawImageToCanvas,
  encodeCanvas,
  imageDataFromBitmap,
} from './canvas';
import { clampInteger, imageError } from './formats';
import { loadJsQr } from './loaders';
import type { ImageFile } from './types';

export async function readQrCode(file: ImageFile): Promise<{ data: string; version: number }> {
  const bitmap = await decodeImage(file.bytes, file.mimeType);
  const { data, width, height } = imageDataFromBitmap(bitmap);
  const module = await loadJsQr();
  const jsQR = module.default ?? module;
  const code = jsQR(new Uint8ClampedArray(data), width, height, {
    inversionAttempts: 'attemptBoth',
  });

  if (!code) throw imageError('No QR code was found in the image.');

  return { data: code.data, version: code.version };
}

export async function sampleImageColor(
  file: ImageFile,
  x?: number,
  y?: number,
): Promise<{ hex: string; rgb: { b: number; g: number; r: number }; x: number; y: number }> {
  const bitmap = await decodeImage(file.bytes, file.mimeType);
  const image = imageDataFromBitmap(bitmap);
  const sampleX = clampInteger(x ?? Math.floor(image.width / 2), 0, image.width - 1);
  const sampleY = clampInteger(y ?? Math.floor(image.height / 2), 0, image.height - 1);
  const index = (sampleY * image.width + sampleX) * 4;
  const rgb = {
    r: image.data[index] ?? 0,
    g: image.data[index + 1] ?? 0,
    b: image.data[index + 2] ?? 0,
  };

  return {
    x: sampleX,
    y: sampleY,
    rgb,
    hex: hexOf(rgb.r, rgb.g, rgb.b),
  };
}

const hexOf = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

export async function dominantImageColors(
  file: ImageFile,
  limit = 5,
): Promise<Array<{ hex: string; percent: number }>> {
  const { data } = imageDataFromBitmap(await decodeImage(file.bytes, file.mimeType));
  const groups = new Map<number, { b: number; count: number; g: number; r: number }>();
  let counted = 0;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;

    const [r, g, b] = [data[index]!, data[index + 1]!, data[index + 2]!];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const group = groups.get(key) ?? { b: 0, count: 0, g: 0, r: 0 };

    group.r += r;
    group.g += g;
    group.b += b;
    group.count += 1;
    groups.set(key, group);
    counted += 1;
  }

  if (!counted) throw imageError('Every pixel is fully transparent: no dominant color.');

  return [...groups.values()]
    .sort((first, second) => second.count - first.count)
    .slice(0, limit)
    .map(({ b, count, g, r }) => ({
      hex: hexOf(Math.round(r / count), Math.round(g / count), Math.round(b / count)),
      percent: Math.round((count / counted) * 10000) / 100,
    }));
}

// Characters ordered from lightest to darkest.
const asciiRamps: Record<'standard' | 'dense' | 'blocks', string> = {
  blocks: ' ░▒▓█',
  dense: ' .,:;irsXA253hMHGS#9B&@',
  standard: ' .:-=+*#%@',
};

export async function imageToAscii(
  file: ImageFile,
  options: { density?: 'standard' | 'dense' | 'blocks'; invert?: boolean; width?: number } = {},
): Promise<string> {
  const bitmap = await decodeImage(file.bytes, file.mimeType);
  const width = clampInteger(options.width ?? 80, 8, 240);
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width * 0.45));
  const image = context2d(drawImageToCanvas(bitmap, width, height)).getImageData(
    0,
    0,
    width,
    height,
  );
  const density = options.density ?? 'standard';
  const ramp = Object.hasOwn(asciiRamps, density) ? asciiRamps[density] : asciiRamps.standard;

  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, column) => {
      const index = (row * width + column) * 4;
      const gray =
        ((image.data[index] ?? 0) + (image.data[index + 1] ?? 0) + (image.data[index + 2] ?? 0)) /
        3;
      const value = options.invert ? 255 - gray : gray;

      return ramp[Math.min(ramp.length - 1, Math.floor((value / 255) * (ramp.length - 1)))];
    }).join(''),
  ).join('\n');
}

export async function pixelDiff(
  before: ImageFile,
  after: ImageFile,
  threshold = 10,
): Promise<{ bytes: Uint8Array; changedPixels: number; height: number; width: number }> {
  const left = imageDataFromBitmap(await decodeImage(before.bytes, before.mimeType));
  const right = imageDataFromBitmap(await decodeImage(after.bytes, after.mimeType));

  if (left.width !== right.width || left.height !== right.height)
    throw imageError('Images must have the same dimensions.');

  const canvas = createCanvas(left.width, left.height);
  const context = context2d(canvas);
  const output = context.createImageData(left.width, left.height);
  let changedPixels = 0;
  const limit = clampInteger(threshold, 0, 255);

  for (let index = 0; index < left.data.length; index += 4) {
    const delta = Math.max(
      Math.abs((left.data[index] ?? 0) - (right.data[index] ?? 0)),
      Math.abs((left.data[index + 1] ?? 0) - (right.data[index + 1] ?? 0)),
      Math.abs((left.data[index + 2] ?? 0) - (right.data[index + 2] ?? 0)),
      Math.abs((left.data[index + 3] ?? 0) - (right.data[index + 3] ?? 0)),
    );
    const changed = delta > limit;

    if (changed) changedPixels += 1;

    output.data.set(changed ? [255, 0, 80, 255] : [0, 0, 0, 0], index);
  }

  context.putImageData(output, 0, 0);

  return {
    bytes: await encodeCanvas(canvas, 'png', 1),
    width: left.width,
    height: left.height,
    changedPixels,
  };
}
