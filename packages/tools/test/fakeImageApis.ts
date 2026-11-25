import { crc32, deflateSync, inflateSync } from 'node:zlib';
import type { SvgRenderRequest } from '@devtoolora/functions/svg';

/**
 * A small stand-in for the browser image APIs (createImageBitmap, OffscreenCanvas) so the
 * image tools can run in node. PNG is encoded and decoded for real; "JPEG" and "WebP" are a
 * real signature followed by a PNG payload, which keeps the pixels inspectable. JPEG drops
 * alpha onto black, as browsers do. Drawing is nearest-neighbor with source-over blending;
 * paths and text are only recorded in `calls`, and so is an SVG sent to the page to render.
 */
export type RawImage = { data: Uint8ClampedArray; height: number; width: number };
export type PngChunk = { data: Uint8Array; type: string };

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const jpegPrefix = [0xff, 0xd8, 0xff, 0xe0];

export function solidImage(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < data.length; index += 4) data.set(rgba, index);

  return { data, height, width };
}

function chunkBytes(type: string, data: Uint8Array): Uint8Array {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  const output = Buffer.alloc(typed.length + 8);

  output.writeUInt32BE(data.length, 0);
  typed.copy(output, 4);
  output.writeUInt32BE(crc32(typed), typed.length + 4);

  return output;
}

export function encodePng(
  image: RawImage,
  options: { chunks?: PngChunk[]; rgb?: boolean } = {},
): Uint8Array {
  const channels = options.rgb ? 3 : 4;
  const header = Buffer.alloc(13);

  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = options.rgb ? 2 : 6;
  const raw = Buffer.alloc((image.width * channels + 1) * image.height);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = (y * image.width + x) * 4;
      const target = y * (image.width * channels + 1) + 1 + x * channels;

      for (let channel = 0; channel < channels; channel += 1)
        raw[target + channel] = image.data[source + channel]!;
    }
  }

  return Buffer.concat([
    Buffer.from(pngSignature),
    chunkBytes('IHDR', header),
    ...(options.chunks ?? []).map((chunk) => chunkBytes(chunk.type, chunk.data)),
    chunkBytes('IDAT', deflateSync(raw)),
    chunkBytes('IEND', new Uint8Array()),
  ]);
}

export function decodePng(bytes: Uint8Array): RawImage {
  const buffer = Buffer.from(bytes);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9]!;
    }

    if (type === 'IDAT') idat.push(data);

    offset += length + 12;
  }

  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[colorType];

  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}.`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= channels ? pixels[y * stride + x - channels]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const upLeft = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels]! : 0;
      const estimate = left + up - upLeft;
      const paeth =
        Math.abs(estimate - left) <= Math.abs(estimate - up) &&
        Math.abs(estimate - left) <= Math.abs(estimate - upLeft)
          ? left
          : Math.abs(estimate - up) <= Math.abs(estimate - upLeft)
            ? up
            : upLeft;
      const predictor = [0, left, up, (left + up) >> 1, paeth][filter] ?? 0;

      pixels[y * stride + x] = (value + predictor) & 0xff;
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const source = index * channels;
    const gray = channels <= 2;

    data[index * 4] = pixels[source]!;
    data[index * 4 + 1] = gray ? pixels[source]! : pixels[source + 1]!;
    data[index * 4 + 2] = gray ? pixels[source]! : pixels[source + 2]!;

    data[index * 4 + 3] =
      channels === 2 ? pixels[source + 1]! : channels === 4 ? pixels[source + 3]! : 255;
  }

  return { data, height, width };
}

export function fakeJpeg(image: RawImage): Uint8Array {
  const opaque = new Uint8ClampedArray(image.data);

  for (let index = 0; index < opaque.length; index += 4) {
    const alpha = opaque[index + 3]! / 255;

    opaque[index]! *= alpha;
    opaque[index + 1]! *= alpha;
    opaque[index + 2]! *= alpha;
    opaque[index + 3] = 255;
  }

  return Buffer.concat([
    Buffer.from(jpegPrefix),
    Buffer.from(encodePng({ ...image, data: opaque })),
  ]);
}

export function fakeWebp(image: RawImage): Uint8Array {
  const png = encodePng(image);
  const header = Buffer.alloc(30);

  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(png.length + 22, 4);
  header.write('WEBPVP8X', 8, 'latin1');
  header.writeUInt32LE(10, 16);
  header[20] = 0x10;

  return Buffer.concat([header, Buffer.from(png)]);
}

export function dataUri(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function decodeAny(bytes: Uint8Array): RawImage {
  const ascii = Buffer.from(bytes.subarray(0, 12)).toString('latin1');

  if (pngSignature.every((value, index) => bytes[index] === value)) return decodePng(bytes);
  if (jpegPrefix.every((value, index) => bytes[index] === value))
    return decodePng(bytes.subarray(4));
  if (ascii.startsWith('RIFF') && ascii.endsWith('WEBP')) return decodePng(bytes.subarray(30));

  throw new Error('The source image could not be decoded.');
}

// drawImage source and destination rectangles: sx, sy, sw, sh, dx, dy, dw, dh.
type DrawImageBox = [number, number, number, number, number, number, number, number];
type DrawState = { fillStyle: unknown; font: string; globalAlpha: number };
export type Call = { args: unknown[]; method: string; state?: DrawState };

class FakeBitmap {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly data: Uint8ClampedArray,
  ) {}
  close(): void {}
}

function parseColor(value: unknown): [number, number, number, number] {
  const hex = String(value).trim().replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(hex))
    return [...hex].map((digit) => parseInt(digit + digit, 16)).concat(255) as [
      number,
      number,
      number,
      number,
    ];
  if (/^[0-9a-f]{6}$/i.test(hex))
    return [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)).concat(255) as [
      number,
      number,
      number,
      number,
    ];

  return [0, 0, 0, 255];
}

class FakeContext {
  fillStyle: unknown = '#000000';
  strokeStyle: unknown = '#000000';
  filter = 'none';
  font = '10px sans-serif';
  globalAlpha = 1;
  lineWidth = 1;
  textAlign = 'start';
  textBaseline = 'alphabetic';
  constructor(
    private readonly canvas: FakeCanvas,
    private readonly calls: Call[],
  ) {
    return new Proxy(this, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);

        if (value !== undefined || typeof property !== 'string') return value;

        return (...args: unknown[]) => {
          calls.push({
            args,
            method: property,
            state: {
              fillStyle: target.fillStyle,
              font: target.font,
              globalAlpha: target.globalAlpha,
            },
          });
        };
      },
    });
  }
  measureText(text: string): { width: number } {
    const fontPx = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);

    return { width: 0.6 * fontPx * text.length };
  }
  private blend(index: number, rgba: ArrayLike<number>): void {
    const pixels = this.canvas.data;
    const alpha = (rgba[3]! / 255) * this.globalAlpha;
    const below = pixels[index + 3]! / 255;
    const outAlpha = alpha + below * (1 - alpha);

    for (let channel = 0; channel < 3; channel += 1) {
      pixels[index + channel] = outAlpha
        ? (rgba[channel]! * alpha + pixels[index + channel]! * below * (1 - alpha)) / outAlpha
        : 0;
    }

    pixels[index + 3] = outAlpha * 255;
  }
  fillRect(x: number, y: number, width: number, height: number): void {
    this.calls.push({
      args: [x, y, width, height],
      method: 'fillRect',
      state: { fillStyle: this.fillStyle, font: this.font, globalAlpha: this.globalAlpha },
    });

    const color = parseColor(this.fillStyle);

    for (
      let row = Math.max(0, Math.round(y));
      row < Math.min(this.canvas.height, Math.round(y + height));
      row += 1
    ) {
      for (
        let column = Math.max(0, Math.round(x));
        column < Math.min(this.canvas.width, Math.round(x + width));
        column += 1
      )
        this.blend((row * this.canvas.width + column) * 4, color);
    }
  }
  clearRect(x: number, y: number, width: number, height: number): void {
    for (let row = Math.max(0, y); row < Math.min(this.canvas.height, y + height); row += 1) {
      for (
        let column = Math.max(0, x);
        column < Math.min(this.canvas.width, x + width);
        column += 1
      )
        this.canvas.data.fill(
          0,
          (row * this.canvas.width + column) * 4,
          (row * this.canvas.width + column) * 4 + 4,
        );
    }
  }
  drawImage(source: FakeBitmap | FakeCanvas, ...args: number[]): void {
    this.calls.push({ args: [source.width, source.height, ...args], method: 'drawImage' });
    const [sx, sy, sw, sh, dx, dy, dw, dh] = (
      args.length === 8
        ? args
        : args.length === 4
          ? [0, 0, source.width, source.height, ...args]
          : [0, 0, source.width, source.height, args[0], args[1], source.width, source.height]
    ) as DrawImageBox;

    for (
      let row = Math.max(0, Math.round(dy));
      row < Math.min(this.canvas.height, Math.round(dy + dh));
      row += 1
    ) {
      for (
        let column = Math.max(0, Math.round(dx));
        column < Math.min(this.canvas.width, Math.round(dx + dw));
        column += 1
      ) {
        const sourceX = Math.floor(sx + ((column - dx + 0.5) * sw) / dw);
        const sourceY = Math.floor(sy + ((row - dy + 0.5) * sh) / dh);

        if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height)
          continue;

        const from = (sourceY * source.width + sourceX) * 4;

        this.blend((row * this.canvas.width + column) * 4, source.data.subarray(from, from + 4));
      }
    }
  }
  getImageData(x: number, y: number, width: number, height: number): RawImage {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let row = 0; row < height; row += 1) {
      const from = ((y + row) * this.canvas.width + x) * 4;

      data.set(this.canvas.data.subarray(from, from + width * 4), row * width * 4);
    }

    return { data, height, width };
  }
  createImageData(width: number, height: number): RawImage {
    return { data: new Uint8ClampedArray(width * height * 4), height, width };
  }
  putImageData(image: RawImage, x: number, y: number): void {
    for (let row = 0; row < image.height; row += 1) {
      this.canvas.data.set(
        image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4),
        ((y + row) * this.canvas.width + x) * 4,
      );
    }
  }
}

class FakeCanvas {
  data: Uint8ClampedArray;
  private context?: FakeContext;
  constructor(
    public width: number,
    public height: number,
    private readonly calls: Call[] = [],
    private readonly webp = true,
  ) {
    this.data = new Uint8ClampedArray(Math.max(1, width) * Math.max(1, height) * 4);
  }
  getContext(kind: string): FakeContext | null {
    if (kind !== '2d') return null;

    this.context ??= new FakeContext(this, this.calls);

    return this.context;
  }
  async convertToBlob(options: { quality?: number; type?: string } = {}): Promise<Blob> {
    this.calls.push({ args: [options], method: 'convertToBlob' });
    const image = { data: this.data, height: this.height, width: this.width };

    if (options.type === 'image/jpeg')
      return new Blob([Buffer.from(fakeJpeg(image))], { type: 'image/jpeg' });
    if (options.type === 'image/webp' && this.webp)
      return new Blob([Buffer.from(fakeWebp(image))], { type: 'image/webp' });

    return new Blob([Buffer.from(encodePng(image))], { type: 'image/png' });
  }
}

export function installFakeImageApis(options: { webp?: boolean } = {}): {
  calls: Call[];
  restore: () => void;
} {
  const calls: Call[] = [];
  const scope = globalThis as Record<string, unknown>;
  const previous = {
    createImageBitmap: scope.createImageBitmap,
    OffscreenCanvas: scope.OffscreenCanvas,
  };
  const webp = options.webp !== false;

  scope.OffscreenCanvas = class extends FakeCanvas {
    constructor(width: number, height: number) {
      super(width, height, calls, webp);
    }
  };

  scope.createImageBitmap = async (blob: Blob) => {
    const image = decodeAny(new Uint8Array(await blob.arrayBuffer()));

    return new FakeBitmap(image.width, image.height, image.data);
  };

  scope.WorkerGlobalScope = class {};

  scope.postMessage = ({ height, port, source, width }: SvgRenderRequest) => {
    calls.push({ args: [source], method: 'renderSvg' });
    port.postMessage({ bytes: encodePng(solidImage(width, height, [0, 0, 0, 0])) });
  };

  return {
    calls,
    restore: () => {
      scope.createImageBitmap = previous.createImageBitmap;
      scope.OffscreenCanvas = previous.OffscreenCanvas;
      delete scope.WorkerGlobalScope;
      delete scope.postMessage;
    },
  };
}

export function decodeArtifact(base64: string): RawImage {
  return decodeAny(new Uint8Array(Buffer.from(base64, 'base64')));
}
