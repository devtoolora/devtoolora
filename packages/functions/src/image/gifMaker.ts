import { parseCssColor } from '../color/cssColor';
import { context2d, createCanvas, decodeImage } from './canvas';
import { detectImageFormat, imageError } from './formats';
import { encodeGifAsync } from './gifEncode';
import type { ImageFile } from './types';

export type GifMakerOptions = {
  background: string;
  delays: number[];
  dither: 'floyd-steinberg' | 'none';
  fit: 'contain' | 'cover' | 'stretch';
  height: number | null;
  /** `null` plays once, 0 loops forever, N repeats N more times. */
  loopCount: number | null;
  width: number | null;
};

const maxFiles = 300;
const maxFileBytes = 10 * 1_048_576;
const maxTotalBytes = 200 * 1_048_576;
const maxSide = 1024;
const maxFramePixels = 100_000_000;
const maxGifBytes = 100 * 1_048_576;
const accepted = new Set(['png', 'jpeg', 'webp', 'bmp', 'gif']);

export function checkFrameBudget(frames: number, width: number, height: number): void {
  if (frames * width * height > maxFramePixels)
    throw imageError(
      `${frames} frames of ${width}×${height} px are too much; frames × pixels may be at most 100,000,000. Use fewer frames or a smaller size.`,
    );
}

function checkInput(files: ImageFile[], options: GifMakerOptions): void {
  if (files.length < 1 || files.length > maxFiles)
    throw imageError(`Provide between 1 and ${maxFiles} images (got ${files.length}).`);

  let total = 0;

  for (const file of files) {
    if (!accepted.has(detectImageFormat(file.bytes)?.format ?? ''))
      throw imageError(`${file.name} is not a PNG, JPEG, WebP, BMP or GIF image.`);

    if (file.bytes.length > maxFileBytes) throw imageError(`${file.name} is larger than 10 MiB.`);

    total += file.bytes.length;
  }

  if (total > maxTotalBytes) throw imageError('The images together are larger than 200 MiB.');

  if (options.delays.length !== files.length)
    throw imageError(
      `Got ${options.delays.length} delays for ${files.length} frames; give one delay per frame.`,
    );

  if (options.delays.some((delay) => !(delay >= 20 && delay <= 60_000)))
    throw imageError('Each delay must be from 20 to 60,000 ms.');

  const { loopCount } = options;

  if (loopCount !== null && (!Number.isInteger(loopCount) || loopCount < 0 || loopCount > 99))
    throw imageError('Repeat must be forever or from 1 to 100 plays.');

  for (const side of [options.width, options.height])
    if (side !== null && (!Number.isInteger(side) || side < 1 || side > maxSide))
      throw imageError(`Width and height must be whole numbers from 1 to 1,024 px.`);
}

async function decodeFile(file: ImageFile): Promise<ImageBitmap> {
  try {
    return await decodeImage(file.bytes, detectImageFormat(file.bytes)?.mimeType ?? file.mimeType);
  } catch {
    throw imageError(`${file.name} could not be decoded as an image.`);
  }
}

async function outputSize(
  file: ImageFile,
  options: GifMakerOptions,
): Promise<{ height: number; width: number }> {
  const bitmap = await decodeFile(file);
  const { height: sourceHeight, width: sourceWidth } = bitmap;

  bitmap.close?.();

  const ratio = sourceWidth / sourceHeight;
  let { height, width } = options;

  if (width === null && height === null) {
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));

    return {
      height: Math.max(1, Math.round(sourceHeight * scale)),
      width: Math.max(1, Math.round(sourceWidth * scale)),
    };
  }

  width ??= Math.round((height ?? 1) * ratio);
  height ??= Math.round(width / ratio);

  if (width < 1 || height < 1 || width > maxSide || height > maxSide)
    throw imageError(`The size would be ${width}×${height} px; each side must be 1 to 1,024.`);

  return { height, width };
}

function backgroundHex(background: string): string | null {
  if (background.trim().toLowerCase() === 'transparent') return null;

  let color;

  try {
    color = parseCssColor(background);
  } catch {
    throw imageError('Background must be transparent or an opaque color.');
  }

  if (color.alpha < 1) throw imageError('Background must be transparent or an opaque color.');

  return `#${[color.r, color.g, color.b]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function destination(
  fit: GifMakerOptions['fit'],
  source: { height: number; width: number },
  target: { height: number; width: number },
): [number, number, number, number] {
  if (fit === 'stretch') return [0, 0, target.width, target.height];

  const scale = (fit === 'contain' ? Math.min : Math.max)(
    target.width / source.width,
    target.height / source.height,
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  return [
    Math.round((target.width - width) / 2),
    Math.round((target.height - height) / 2),
    width,
    height,
  ];
}

export function gifSizeText(bytes: number): string {
  const kilobytes = (bytes / 1000).toFixed(1);

  return kilobytes === '1000.0' || bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${kilobytes} kB`;
}

function loopText(loopCount: number | null): string {
  if (loopCount === null) return 'plays once';

  return loopCount === 0 ? 'loops forever' : `plays ${loopCount + 1} times`;
}

export async function createGif(
  files: ImageFile[],
  options: GifMakerOptions,
): Promise<{ gif: Uint8Array; summary: string; text: string }> {
  checkInput(files, options);
  const fill = backgroundHex(options.background);
  const first = files[0];

  if (!first) throw imageError('Provide at least one image.');

  const size = await outputSize(first, options);

  checkFrameBudget(files.length, size.width, size.height);

  const labels: string[] = [];
  const lines: string[] = [];
  const delays = options.delays.map((delay) => Math.round(delay / 10) * 10);

  async function* frames() {
    for (const [index, file] of files.entries()) {
      const bitmap = await decodeFile(file);
      const canvas = createCanvas(size.width, size.height);
      const context = context2d(canvas);

      try {
        if (fill !== null) {
          context.fillStyle = fill;
          context.fillRect(0, 0, size.width, size.height);
        }

        const [x, y, width, height] = destination(options.fit, bitmap, size);

        context.drawImage(bitmap, x, y, width, height);
      } finally {
        bitmap.close?.();
      }

      const rgba = context.getImageData(0, 0, size.width, size.height).data;
      const delay = delays[index] ?? 100;

      labels.push(`Frame ${index + 1} · ${file.name} · ${delay} ms`);

      yield { delayCs: delay / 10, rgba };
    }
  }

  const gif = await encodeGifAsync(frames(), {
    dither: options.dither,
    height: size.height,
    loopCount: options.loopCount,
    maxBytes: maxGifBytes,
    width: size.width,
    onFrame: (colors) =>
      lines.push(`${labels[lines.length] ?? ''} · ${colors} color${colors === 1 ? '' : 's'}`),
  });
  const seconds = (delays.reduce((sum, delay) => sum + delay, 0) / 1000).toFixed(2);

  return {
    gif,
    summary: `${files.length} frame${files.length === 1 ? '' : 's'} · ${size.width}×${size.height} · ${seconds} s per loop · ${loopText(options.loopCount)} · ${gifSizeText(gif.length)}.`,
    text: lines.join('\n'),
  };
}
