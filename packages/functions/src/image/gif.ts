import { imageError } from './formats';
import { decodeLzw, interlaceOrder } from './gifLzw';
import { missingFrame } from './gifSelection';

export type GifFrame = {
  delayCs: number;
  disposal: 0 | 1 | 2 | 3;
  index: number;
  localPalette: boolean;
  playedMs: number;
  rect: { height: number; left: number; top: number; width: number };
  rgba: Uint8ClampedArray;
  transparentIndex: number | null;
};

export type GifDecodeResult = {
  frameCount: number;
  frames: GifFrame[];
  height: number;
  loopCount: number | null;
  notes: string[];
  truncatedAt: number | null;
  width: number;
};

type GifStream = Omit<GifDecodeResult, 'frames'> & { frames: Iterable<GifFrame> };

type Control = Pick<GifFrame, 'delayCs' | 'disposal' | 'transparentIndex'>;

type ScannedFrame = Control & {
  dataEnd: number;
  dataStart: number;
  interlaced: boolean;
  localPalette: boolean;
  minCodeSize: number;
  palette: Uint8Array;
  rect: GifFrame['rect'];
  unterminated: boolean;
};

type Scan = {
  frames: ScannedFrame[];
  loopCount: number | null;
  notes: string[];
  truncatedAt: number | null;
};

type Screen = { height: number; width: number };

type Clip = { bottom: number; left: number; right: number; top: number };

const maxSide = 4096;
const maxFrames = 1000;
const maxPixels = 200_000_000;
const knownExtensions = new Set([0x01, 0xf9, 0xfe, 0xff]);
const loopIds = new Set(['ANIMEXTS1.0', 'NETSCAPE2.0']);

function word(bytes: Uint8Array, position: number): number {
  return (bytes[position] ?? 0) | ((bytes[position + 1] ?? 0) << 8);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function skipSubBlocks(bytes: Uint8Array, start: number, allowMissingTerminator = false): number {
  let position = start;

  while (position < bytes.length) {
    const length = bytes[position] ?? 0;

    if (length === 0) return position + 1;

    position += length + 1;
  }

  return allowMissingTerminator && position === bytes.length && position > start ? position : -1;
}

function joinSubBlocks(bytes: Uint8Array, start: number, end: number): Uint8Array {
  const data = new Uint8Array(end - start);
  let position = start;
  let length = 0;

  while (position < end) {
    const size = bytes[position] ?? 0;

    data.set(bytes.subarray(position + 1, position + 1 + size), length);
    length += size;
    position += size + 1;
  }

  return data.subarray(0, length);
}

function readControl(bytes: Uint8Array, start: number): Control | null {
  if ((bytes[start] ?? 0) < 4) return null;

  const packed = bytes[start + 1] ?? 0;
  const disposal = (packed >> 2) & 7;

  return {
    delayCs: word(bytes, start + 2),
    disposal: disposal === 1 || disposal === 2 || disposal === 3 ? disposal : 0,
    transparentIndex: packed & 1 ? (bytes[start + 4] ?? 0) : null,
  };
}

function readLoop(bytes: Uint8Array, start: number): number | null {
  if (bytes[start] !== 11 || !loopIds.has(ascii(bytes, start + 1, start + 12))) return null;

  const block = start + 12;

  return (bytes[block] ?? 0) >= 3 && bytes[block + 1] === 1 ? word(bytes, block + 2) : null;
}

function readDescriptor(
  bytes: Uint8Array,
  start: number,
  globalPalette: Uint8Array,
  control: Control | null,
): ScannedFrame | null {
  const packed = bytes[start + 9] ?? 0;
  const paletteStart = start + 10;
  const paletteEnd = paletteStart + (packed & 0x80 ? 3 << ((packed & 7) + 1) : 0);
  const strictEnd = paletteEnd < bytes.length ? skipSubBlocks(bytes, paletteEnd + 1) : -1;
  const dataEnd =
    strictEnd < 0 && paletteEnd < bytes.length
      ? skipSubBlocks(bytes, paletteEnd + 1, true)
      : strictEnd;

  if (dataEnd < 0) return null;

  return {
    dataEnd,
    dataStart: paletteEnd + 1,
    delayCs: control?.delayCs ?? 0,
    disposal: control?.disposal ?? 0,
    interlaced: (packed & 0x40) !== 0,
    localPalette: (packed & 0x80) !== 0,
    minCodeSize: bytes[paletteEnd] ?? 0,
    palette: packed & 0x80 ? bytes.subarray(paletteStart, paletteEnd) : globalPalette,
    rect: {
      height: word(bytes, start + 7),
      left: word(bytes, start + 1),
      top: word(bytes, start + 3),
      width: word(bytes, start + 5),
    },
    transparentIndex: control?.transparentIndex ?? null,
    unterminated: strictEnd < 0,
  };
}

function scanBlocks(bytes: Uint8Array, start: number, globalPalette: Uint8Array): Scan {
  const scan: Scan = { frames: [], loopCount: null, notes: [], truncatedAt: null };
  let control: Control | null = null;
  let position = start;

  while (position < bytes.length && bytes[position] !== 0x3b) {
    const block = bytes[position];
    let end = -1;

    if (block === 0x21) {
      const label = bytes[position + 1];

      end = skipSubBlocks(bytes, position + 2);
      if (end >= 0 && !knownExtensions.has(label ?? 0))
        scan.notes.push(
          `Extension block 0x${(label ?? 0).toString(16)} after frame ${scan.frames.length} was ignored.`,
        );
      if (end >= 0 && label === 0xf9) control = readControl(bytes, position + 2);
      if (end >= 0 && label === 0xff)
        scan.loopCount = readLoop(bytes, position + 2) ?? scan.loopCount;
    } else if (block === 0x2c) {
      if (scan.frames.length === maxFrames) throw imageError('The GIF has more than 1,000 frames.');

      const frame = readDescriptor(bytes, position, globalPalette, control);

      control = null;
      if (frame) scan.frames.push(frame);
      if (frame?.unterminated)
        scan.notes.push(
          `Frame ${scan.frames.length} is missing its closing 0x00 byte; it was decoded anyway.`,
        );

      end = frame ? frame.dataEnd : -1;
    } else {
      scan.notes.push(`Data after frame ${scan.frames.length} is not GIF data; it was ignored.`);

      break;
    }

    if (end < 0) {
      scan.truncatedAt = scan.frames.length + 1;

      break;
    }

    position = end;
  }

  return scan;
}

function checkPixels(
  frames: ScannedFrame[],
  wanted: Set<number>,
  last: number,
  screen: Screen,
): void {
  const screenPixels = screen.width * screen.height;
  let pixels = 0;

  frames.slice(0, last).forEach(({ rect }, index) => {
    const area = rect.width * rect.height;

    if (area > maxPixels) throw imageError(`Frame ${index + 1} is larger than 200,000,000 pixels.`);

    pixels += wanted.has(index + 1) ? Math.max(area, screenPixels) : area;
  });

  if (pixels > maxPixels)
    throw imageError('Decoding would need more than 200,000,000 pixels; select fewer frames.');
}

function clipRect({ height, left, top, width }: GifFrame['rect'], screen: Screen): Clip {
  return {
    bottom: Math.min(top + height, screen.height),
    left,
    right: Math.min(left + width, screen.width),
    top,
  };
}

function prepareDisposal(
  canvas: Uint8ClampedArray,
  disposal: number,
  clip: Clip,
  screenWidth: number,
): (() => void) | null {
  if (disposal < 2 || clip.right <= clip.left || clip.bottom <= clip.top) return null;

  const rowBytes = (clip.right - clip.left) * 4;
  const offset = (y: number): number => (y * screenWidth + clip.left) * 4;

  if (disposal === 2)
    return () => {
      for (let y = clip.top; y < clip.bottom; y += 1)
        canvas.fill(0, offset(y), offset(y) + rowBytes);
    };

  const saved = new Uint8ClampedArray(rowBytes * (clip.bottom - clip.top));

  for (let y = clip.top; y < clip.bottom; y += 1)
    saved.set(canvas.subarray(offset(y), offset(y) + rowBytes), (y - clip.top) * rowBytes);

  return () => {
    for (let y = clip.top; y < clip.bottom; y += 1)
      canvas.set(
        saved.subarray((y - clip.top) * rowBytes, (y - clip.top + 1) * rowBytes),
        offset(y),
      );
  };
}

function drawFrame(
  bytes: Uint8Array,
  frame: ScannedFrame,
  number: number,
  canvas: Uint8ClampedArray,
  clip: Clip,
  screenWidth: number,
): number {
  const { palette, rect, transparentIndex } = frame;
  const order = frame.interlaced ? interlaceOrder(rect.height) : null;
  const data = joinSubBlocks(bytes, frame.dataStart, frame.dataEnd);
  const written = decodeLzw(
    data,
    frame.minCodeSize,
    rect.width,
    rect.height,
    (row, length, streamRow) => {
      const y = rect.top + (order ? (order[streamRow] ?? 0) : streamRow);
      const end = Math.min(length, clip.right - rect.left);

      if (y >= clip.bottom) return;

      for (let x = 0, offset = (y * screenWidth + rect.left) * 4; x < end; x += 1, offset += 4) {
        const index = row[x] ?? 0;

        if (index === transparentIndex) continue;

        canvas[offset] = palette[index * 3] ?? 0;
        canvas[offset + 1] = palette[index * 3 + 1] ?? 0;
        canvas[offset + 2] = palette[index * 3 + 2] ?? 0;
        canvas[offset + 3] = 255;
      }
    },
  );

  if (written < 0) throw imageError(`Frame ${number} has corrupt image data.`);

  return written;
}

/**
 * Composites frames 1..last onto one canvas and yields each selected one. Every yielded `rgba` is
 * that canvas, so it is valid only until the next frame is requested.
 */
function* composite(
  bytes: Uint8Array,
  scan: Scan,
  wanted: Set<number>,
  last: number,
  screen: Screen,
): Generator<GifFrame> {
  const canvas = new Uint8ClampedArray(screen.width * screen.height * 4);
  let dispose: (() => void) | null = null;

  for (const [index, frame] of scan.frames.slice(0, last).entries()) {
    const number = index + 1;
    const { rect } = frame;
    const clip = clipRect(rect, screen);

    dispose?.();
    if (clip.right < rect.left + rect.width || clip.bottom < rect.top + rect.height)
      scan.notes.push(`Frame ${number} extends outside the screen; it was clipped.`);

    dispose = prepareDisposal(canvas, frame.disposal, clip, screen.width);

    if (drawFrame(bytes, frame, number, canvas, clip, screen.width) < rect.width * rect.height)
      scan.notes.push(`Frame ${number} is missing pixels; they were not drawn.`);

    if (!wanted.has(number)) continue;

    yield {
      delayCs: frame.delayCs,
      disposal: frame.disposal,
      index: number,
      localPalette: frame.localPalette,
      // Browsers play delays of 0 and 1 cs as 100 ms.
      playedMs: frame.delayCs <= 1 ? 100 : frame.delayCs * 10,
      rect,
      rgba: canvas,
      transparentIndex: frame.transparentIndex,
    };
  }
}

function readScreen(bytes: Uint8Array): Screen & { globalPalette: Uint8Array; start: number } {
  const magic = ascii(bytes, 0, 6);

  if (bytes.length < 13 || (magic !== 'GIF87a' && magic !== 'GIF89a'))
    throw imageError('This is not a GIF file.');

  const width = word(bytes, 6);
  const height = word(bytes, 8);
  const packed = bytes[10] ?? 0;
  const start = 13 + (packed & 0x80 ? 3 << ((packed & 7) + 1) : 0);

  if (width < 1 || width > maxSide || height < 1 || height > maxSide)
    throw imageError('GIF screen must be 1-4,096 px per side.');

  return { globalPalette: bytes.subarray(13, start), height, start, width };
}

export function streamGif(bytes: Uint8Array, options: { frames?: number[] } = {}): GifStream {
  const { globalPalette, height, start, width } = readScreen(bytes);
  const scan = scanBlocks(bytes, start, globalPalette);
  const frameCount = scan.frames.length;

  if (frameCount === 0) throw imageError('The GIF has no frames.');

  const wanted = new Set(options.frames ?? scan.frames.map((_, index) => index + 1));

  for (const frame of wanted)
    if (!Number.isInteger(frame) || frame < 1 || frame > frameCount)
      throw missingFrame(String(frame), frameCount);

  const last = Math.max(0, ...wanted);

  checkPixels(scan.frames, wanted, last, { height, width });

  const frames = last > 0 ? composite(bytes, scan, wanted, last, { height, width }) : [];
  const { loopCount, notes, truncatedAt } = scan;

  return { frameCount, frames, height, loopCount, notes, truncatedAt, width };
}

/** Decodes a GIF into a copy of each selected composited frame; small GIFs only. */
export function decodeGif(bytes: Uint8Array, options: { frames?: number[] } = {}): GifDecodeResult {
  const stream = streamGif(bytes, options);
  const frames = Array.from(stream.frames, (frame) => ({ ...frame, rgba: frame.rgba.slice() }));

  return { ...stream, frames };
}
