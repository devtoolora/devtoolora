import { context2d, createCanvas, decodeImage, encodeCanvas } from './canvas';
import { imageError } from './formats';
import {
  packSprites,
  spriteClassNames,
  spriteCss,
  type SpriteLayout,
  type SpriteLayoutKind,
} from './spritePack';
import type { ImageFile } from './types';

const maxImages = 200;
const maxImageSide = 4096;
const maxImageBytes = 10 * 1024 * 1024;
const maxSheetSide = 8192;

export type SpriteSheetOptions = {
  layout: SpriteLayoutKind;
  padding: number;
  pixelRatio: 1 | 2;
  prefix: string;
};

function checkOptions(files: ImageFile[], options: SpriteSheetOptions): void {
  if (files.length < 1 || files.length > maxImages)
    throw imageError(`Provide between 1 and ${maxImages} images (got ${files.length}).`);

  if (!/^[a-z][a-z0-9-]{0,31}$/.test(options.prefix))
    throw imageError(
      'Class prefix must start with a lowercase letter and use only a-z, 0-9 and hyphens (at most 32 characters).',
    );

  if (!Number.isInteger(options.padding) || options.padding < 0 || options.padding > 64)
    throw imageError('Padding must be a whole number from 0 to 64 px.');
}

/** Reads each size and closes the bitmap at once, so only one bitmap is open at a time. */
async function measureAll(
  files: ImageFile[],
): Promise<Array<{ height: number; name: string; width: number }>> {
  const sizes = [];

  for (const file of files) {
    if (file.bytes.length > maxImageBytes) throw imageError(`${file.name} is larger than 10 MiB.`);

    const bitmap = await decodeFile(file);
    const { height, width } = bitmap;

    bitmap.close?.();

    if (width > maxImageSide || height > maxImageSide)
      throw imageError(
        `${file.name} is ${width} × ${height} px; the limit is ${maxImageSide} × ${maxImageSide} px.`,
      );

    sizes.push({ height, name: file.name, width });
  }

  return sizes;
}

async function decodeFile(file: ImageFile): Promise<ImageBitmap> {
  try {
    return await decodeImage(file.bytes, file.mimeType);
  } catch {
    throw imageError(`${file.name} could not be decoded as an image.`);
  }
}

function spriteJson(layout: SpriteLayout, classNames: string[], pixelRatio: 1 | 2): string {
  const frames = Object.fromEntries(
    layout.frames.map((frame, index) => [
      classNames[index],
      { h: frame.height, source: frame.name, w: frame.width, x: frame.x, y: frame.y },
    ]),
  );
  const meta = {
    image: 'sprite.png',
    pixelRatio,
    size: { h: layout.height, w: layout.width },
  };

  return JSON.stringify({ frames, meta }, null, 2);
}

export async function createSpriteSheet(
  files: ImageFile[],
  options: SpriteSheetOptions,
): Promise<{ css: string; json: string; png: Uint8Array; summary: string }> {
  checkOptions(files, options);
  const layout = packSprites(await measureAll(files), options);

  if (layout.width > maxSheetSide || layout.height > maxSheetSide)
    throw imageError(
      `The sheet would need ${layout.width} × ${layout.height} px; the limit is ${maxSheetSide} px per side. Use fewer or smaller images, or less padding.`,
    );

  const canvas = createCanvas(layout.width, layout.height);
  const context = context2d(canvas);

  for (const [index, frame] of layout.frames.entries()) {
    const file = files[index];

    if (!file) continue;

    const bitmap = await decodeFile(file);

    try {
      context.drawImage(bitmap, frame.x, frame.y);
    } finally {
      bitmap.close?.();
    }
  }

  const classNames = spriteClassNames(
    files.map((file) => file.name),
    options.prefix,
  );

  return {
    css: spriteCss(layout, classNames, options),
    json: spriteJson(layout, classNames, options.pixelRatio),
    png: await encodeCanvas(canvas, 'png', 1),
    summary: `${files.length} ${files.length === 1 ? 'image' : 'images'} packed into ${layout.width}\u00d7${layout.height} px (${options.layout} layout, ${options.padding} px padding).`,
  };
}
