import { imageError } from './formats';
import { quantizeFrame } from './quantize';

export type GifEncodeFrame = { delayCs: number; rgba: Uint8ClampedArray };

export type GifEncodeOptions = {
  dither: 'floyd-steinberg' | 'none';
  height: number;
  loopCount: number | null;
  maxBytes: number;
  width: number;
  onFrame?(colors: number): void;
};

const maxCodes = 4096;
const hashSize = 1 << 13;

export function encodeLzw(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const out: number[] = [];
  const keys = new Int32Array(hashSize).fill(-1);
  const codes = new Uint16Array(hashSize);
  let acc = 0;
  let bits = 0;
  let size = minCodeSize + 1;
  let next = clear + 2;

  const emit = (code: number): void => {
    acc |= code << bits;
    bits += size;

    while (bits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  };

  emit(clear);

  let prefix = indices[0] ?? 0;

  for (let i = 1; i < indices.length; i += 1) {
    const byte = indices[i] ?? 0;
    const key = (prefix << 8) | byte;
    let slot = (Math.imul(key, 2654435761) >>> 19) & (hashSize - 1);

    while (keys[slot] !== -1 && keys[slot] !== key) slot = (slot + 1) & (hashSize - 1);

    if (keys[slot] === key) {
      prefix = codes[slot] ?? 0;

      continue;
    }

    emit(prefix);
    keys[slot] = key;
    codes[slot] = next;
    next += 1;
    // The decoder lags one entry behind, so the width grows once an entry passes the boundary.
    if (next - 1 === 1 << size && size < 12) size += 1;

    if (next === maxCodes) {
      emit(clear);
      keys.fill(-1);
      size = minCodeSize + 1;
      next = clear + 2;
    }

    prefix = byte;
  }

  if (indices.length > 0) emit(prefix);

  emit(clear + 1);
  if (bits > 0) out.push(acc & 255);

  return Uint8Array.from(out);
}

function paletteBits(count: number): number {
  return Math.max(1, Math.ceil(Math.log2(count)));
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function u16(value: number): number[] {
  return [value & 255, (value >> 8) & 255];
}

function subBlocks(data: Uint8Array): number[] {
  const out: number[] = [];

  for (let at = 0; at < data.length; at += 255) {
    const block = data.subarray(at, at + 255);

    out.push(block.length, ...block);
  }

  out.push(0);

  return out;
}

type Sink = { done: () => Uint8Array; push: (chunk: ArrayLike<number>) => void };

function createSink(maxBytes: number): Sink {
  const chunks: Uint8Array[] = [];
  let total = 0;

  return {
    done: () => {
      const out = new Uint8Array(total);
      let at = 0;

      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }

      return out;
    },
    push: (chunk) => {
      total += chunk.length;
      if (total > maxBytes) throw imageError('The GIF would exceed 100 MiB.');

      chunks.push(Uint8Array.from(chunk));
    },
  };
}

function writeHeader(sink: Sink, { height, loopCount, width }: GifEncodeOptions): void {
  sink.push([...ascii('GIF89a'), ...u16(width), ...u16(height), 0, 0, 0]);

  if (loopCount !== null) {
    sink.push([0x21, 0xff, 11, ...ascii('NETSCAPE2.0'), 3, 1, ...u16(loopCount), 0]);
  }
}

function writeFrame(sink: Sink, frame: GifEncodeFrame, options: GifEncodeOptions): void {
  const { height, width } = options;
  const { indices, palette, transparentIndex } = quantizeFrame(
    frame.rgba,
    width,
    height,
    options.dither,
  );
  const bits = paletteBits(palette.length / 3);
  const table = new Uint8Array(3 << bits);
  const minCodeSize = Math.max(2, bits);
  const transparent = transparentIndex !== null;

  table.set(palette);

  sink.push([
    0x21,
    0xf9,
    4,
    (2 << 2) | (transparent ? 1 : 0),
    ...u16(frame.delayCs),
    transparentIndex ?? 0,
    0,
  ]);

  sink.push([0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height), 0x80 | (bits - 1)]);
  sink.push(table);
  sink.push([minCodeSize]);
  sink.push(subBlocks(encodeLzw(indices, minCodeSize)));
  options.onFrame?.(palette.length / 3 - (transparent ? 1 : 0));
}

export function encodeGif(frames: Iterable<GifEncodeFrame>, options: GifEncodeOptions): Uint8Array {
  const sink = createSink(options.maxBytes);

  writeHeader(sink, options);
  for (const frame of frames) writeFrame(sink, frame, options);
  sink.push([0x3b]);

  return sink.done();
}

export async function encodeGifAsync(
  frames: AsyncIterable<GifEncodeFrame>,
  options: GifEncodeOptions,
): Promise<Uint8Array> {
  const sink = createSink(options.maxBytes);

  writeHeader(sink, options);
  for await (const frame of frames) writeFrame(sink, frame, options);
  sink.push([0x3b]);

  return sink.done();
}
