import { strToU8, zipSync } from 'fflate';
import type { JsonValue } from '../format/json';
import { context2d, createCanvas, encodeCanvas } from './canvas';
import { imageError } from './formats';
import { streamGif } from './gif';
import type { GifFrame } from './gif';
import { parseFrameSelection } from './gifSelection';

export type GifFramesResult = {
  fileName: string;
  firstPng: Uint8Array;
  report: JsonValue;
  summary: string;
  zip: Uint8Array;
};

const maxZipBytes = 200 * 1_048_576;

async function encodeFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = createCanvas(width, height);
  const context = context2d(canvas);
  const image = context.createImageData(width, height);

  image.data.set(rgba);
  context.putImageData(image, 0, 0);

  return encodeCanvas(canvas, 'png', 1);
}

function loopText(loopCount: number | null): string {
  if (loopCount === null) return 'plays once';

  return loopCount === 0 ? 'loops forever' : `loops ${loopCount} time${loopCount === 1 ? '' : 's'}`;
}

export async function extractGifFrames(
  bytes: Uint8Array,
  name: string,
  selection: string,
  limit = maxZipBytes,
): Promise<GifFramesResult> {
  const { frameCount } = streamGif(bytes, { frames: [] });
  const decoded = streamGif(bytes, { frames: parseFrameSelection(selection, frameCount) });
  const { height, loopCount, notes, truncatedAt, width } = decoded;
  const digits = Math.max(3, String(frameCount).length);
  const base = name.replace(/[\\/]/g, '').replace(/\.[^.]*$/, '') || 'frames';
  const frames: Omit<GifFrame, 'rgba'>[] = [];
  const files: Record<string, Uint8Array> = {};
  let firstPng: Uint8Array = new Uint8Array();
  let total = 0;

  for (const { rgba, ...frame } of decoded.frames) {
    const png = await encodeFrame(rgba, width, height);

    total += png.length;
    if (total > limit) throw imageError('The zip would exceed 200 MiB; select fewer frames.');

    if (firstPng.length === 0) firstPng = png;

    files[`${base}-${String(frame.index).padStart(digits, '0')}.png`] = png;
    frames.push(frame);
  }

  const report: JsonValue = { frames, height, loopCount, width };

  files[`${base}-frames.json`] = strToU8(JSON.stringify(report, null, 2));

  const seconds = (frames.reduce((total, frame) => total + frame.playedMs, 0) / 1000).toFixed(2);
  const summary = [
    `${frames.length} frame${frames.length === 1 ? '' : 's'} · ${width}×${height} · ${seconds} s per loop · ${loopText(loopCount)}.`,
    ...(truncatedAt === null
      ? []
      : [`The file ends inside frame ${truncatedAt}; frames 1-${truncatedAt - 1} were kept.`]),
    ...notes,
  ].join(' ');

  return {
    fileName: `${base}-frames.zip`,
    firstPng,
    report,
    summary,
    zip: zipSync(files, { mtime: new Date(1980, 0, 1) }),
  };
}
