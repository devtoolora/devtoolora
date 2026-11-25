/** Test-only GIF writer: enough of GIF89a to build fixtures and malformed inputs. */

type Rgb = [number, number, number];

export type GifBuilderFrame = {
  clearCodes?: boolean;
  data?: number[];
  delayCs?: number;
  disposal?: number;
  height: number;
  interlaced?: boolean;
  left?: number;
  localPalette?: Rgb[];
  minCodeSize?: number;
  pixels?: number[];
  top?: number;
  transparentIndex?: number;
  width: number;
};

export type GifBuilderOptions = {
  comment?: string;
  frames: GifBuilderFrame[];
  height: number;
  loop?: { count: number; id?: 'ANIMEXTS1.0' | 'NETSCAPE2.0' };
  palette?: Rgb[];
  version?: '87a' | '89a';
  width: number;
};

function packCodes(codes: { code: number; size: number }[]): number[] {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;

  for (const { code, size } of codes) {
    acc |= code << bits;
    bits += size;

    while (bits >= 8) {
      bytes.push(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
    }
  }

  if (bits > 0) bytes.push(acc & 0xff);

  return bytes;
}

function encodeLzw(indices: number[], minCodeSize: number, clearCodes = true): number[] {
  const clear = 1 << minCodeSize;
  const codes: { code: number; size: number }[] = [];
  let table = new Map<string, number>();
  let next = clear + 2;
  let size = minCodeSize + 1;
  let current = '';
  let currentCode = -1;
  let sinceClear = 0;

  const reset = (): void => {
    table = new Map();
    next = clear + 2;
    size = minCodeSize + 1;
    sinceClear = 0;
  };

  if (clearCodes) codes.push({ code: clear, size });

  for (const index of indices) {
    const candidate = `${current},${index}`;
    const known = current === '' ? index : table.get(candidate);

    if (known !== undefined) {
      current = current === '' ? String(index) : candidate;
      currentCode = known;

      continue;
    }

    codes.push({ code: currentCode, size });
    sinceClear += 1;

    if (next < 4096) {
      table.set(candidate, next);
      next += 1;
      if (next > 1 << size && size < 12) size += 1;
    } else if (clearCodes) {
      codes.push({ code: clear, size });
      reset();
    }

    current = String(index);
    currentCode = index;
  }

  if (currentCode >= 0) {
    codes.push({ code: currentCode, size });
    // The decoder adds an entry for this last code too, which can grow the end code by a bit.
    if (sinceClear >= 1 && next === 1 << size && size < 12) size += 1;
  }

  codes.push({ code: clear + 1, size });

  return packCodes(codes);
}

function word(value: number): number[] {
  return [value & 0xff, value >> 8];
}

function subBlocks(data: number[]): number[] {
  const out: number[] = [];

  for (let start = 0; start < data.length; start += 255) {
    const chunk = data.slice(start, start + 255);

    out.push(chunk.length, ...chunk);
  }

  out.push(0);

  return out;
}

function paletteBytes(palette: Rgb[]): { bits: number; bytes: number[] } {
  let bits = 0;

  while (2 << bits < palette.length) bits += 1;

  const bytes = palette.flat();

  while (bytes.length < (2 << bits) * 3) bytes.push(0);

  return { bits, bytes };
}

function interlace(pixels: number[], width: number, height: number): number[] {
  const out: number[] = [];

  for (const [start, step] of [
    [0, 8],
    [4, 8],
    [2, 4],
    [1, 2],
  ] as const) {
    for (let row = start; row < height; row += step)
      out.push(...pixels.slice(row * width, (row + 1) * width));
  }

  return out;
}

function frameBytes(frame: GifBuilderFrame): number[] {
  const out: number[] = [];
  const { delayCs, disposal, transparentIndex } = frame;

  if (delayCs !== undefined || disposal !== undefined || transparentIndex !== undefined) {
    const packed = ((disposal ?? 0) << 2) | (transparentIndex === undefined ? 0 : 1);

    out.push(0x21, 0xf9, 4, packed, ...word(delayCs ?? 0), transparentIndex ?? 0, 0);
  }

  const local = frame.localPalette && paletteBytes(frame.localPalette);
  const packed = (local ? 0x80 | local.bits : 0) | (frame.interlaced ? 0x40 : 0);
  const minCodeSize = frame.minCodeSize ?? 2;
  const pixels = frame.pixels ?? [];
  const ordered = frame.interlaced ? interlace(pixels, frame.width, frame.height) : pixels;

  out.push(0x2c, ...word(frame.left ?? 0), ...word(frame.top ?? 0));
  out.push(...word(frame.width), ...word(frame.height), packed, ...(local ? local.bytes : []));
  out.push(minCodeSize);
  out.push(...subBlocks(frame.data ?? encodeLzw(ordered, minCodeSize, frame.clearCodes)));

  return out;
}

function extensionBytes(options: GifBuilderOptions): number[] {
  const out: number[] = [];

  if (options.loop) {
    const id = [...(options.loop.id ?? 'NETSCAPE2.0')].map((char) => char.charCodeAt(0));

    out.push(0x21, 0xff, 11, ...id, 3, 1, ...word(options.loop.count), 0);
  }

  if (options.comment !== undefined) {
    const text = [...options.comment].map((char) => char.charCodeAt(0));

    out.push(0x21, 0xfe, ...subBlocks(text));
  }

  return out;
}

export function buildGif(options: GifBuilderOptions): Uint8Array {
  const global = options.palette && paletteBytes(options.palette);
  const header = [...`GIF${options.version ?? '89a'}`].map((char) => char.charCodeAt(0));
  const out = [...header, ...word(options.width), ...word(options.height)];

  out.push(global ? 0x80 | 0x70 | global.bits : 0, 0, 0, ...(global ? global.bytes : []));
  out.push(...extensionBytes(options));
  for (const frame of options.frames) out.push(...frameBytes(frame));
  out.push(0x3b);

  return Uint8Array.from(out);
}
