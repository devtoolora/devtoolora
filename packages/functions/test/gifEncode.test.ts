import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { decodeGif } from '@devtoolora/functions/image';
import { encodeGif, encodeGifAsync, encodeLzw } from '../src/image/gifEncode';
import { decodeLzw } from '../src/image/gifLzw';
import { quantizeFrame } from '../src/image/quantize';

function decodeIndices(data: Uint8Array, minCodeSize: number, count: number): number[] {
  const out: number[] = [];

  decodeLzw(data, minCodeSize, count, 1, (row, length) => out.push(...row.slice(0, length)));

  return out;
}

function clearPositions(data: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const found: number[] = [];
  let size = minCodeSize + 1;
  let next = clear + 2;
  let bits = 0;
  let acc = 0;
  let pos = 0;
  let count = 0;
  let previous = -1;

  for (;;) {
    while (bits < size && pos < data.length) {
      acc |= (data[pos++] ?? 0) << bits;
      bits += 8;
    }

    if (bits < size) break;

    const code = acc & ((1 << size) - 1);

    acc >>>= size;
    bits -= size;
    if (code === clear + 1) break;
    if (code === clear) {
      found.push(count);
      size = minCodeSize + 1;
      next = clear + 2;
      previous = -1;
    } else {
      if (previous >= 0 && next < 4096) next += 1;
      if (next === 1 << size && size < 12) size += 1;

      previous = code;
    }

    count += 1;
  }

  return found;
}

function rgbaOf(colors: number[][], width: number, height: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    rgba.set(colors[i % colors.length] ?? [0, 0, 0, 255], i * 4);
  }

  return rgba;
}

describe('encodeLzw', () => {
  it('round-trips hand-built index streams', () => {
    for (const [indices, minCode] of [
      [[0, 1, 2, 3, 0, 0, 0, 0, 1, 1, 1, 1, 2, 3], 2],
      [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 2],
      [[4, 4, 4, 4, 1, 2, 3, 4, 5, 6, 7], 3],
    ] as const) {
      const encoded = encodeLzw(Uint8Array.from(indices), minCode);

      assert.deepEqual(decodeIndices(encoded, minCode, indices.length), [...indices]);
    }
  });

  it('resets the table on high-entropy 256-color data', () => {
    let seed = 12345;
    const indices = new Uint8Array(256 * 256);

    for (let i = 0; i < indices.length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      indices[i] = seed >>> 24;
    }

    const encoded = encodeLzw(indices, 8);
    const clears = clearPositions(encoded, 8);

    assert.ok(clears.some((position) => position > 0));
    assert.deepEqual(decodeIndices(encoded, 8, indices.length), [...indices]);
  });
});

describe('quantizeFrame', () => {
  it('keeps an exact palette for few colors and maps transparency', () => {
    const rgba = rgbaOf(
      [
        [10, 20, 30, 255],
        [200, 100, 50, 255],
        [0, 0, 0, 0],
      ],
      3,
      1,
    );
    const frame = quantizeFrame(rgba, 3, 1, 'none');

    assert.equal(frame.transparentIndex, 2);
    assert.deepEqual([...frame.indices], [0, 1, 2]);
    assert.deepEqual([...frame.palette.slice(0, 6)], [10, 20, 30, 200, 100, 50]);
  });

  it('caps 300+ colors plus transparency and decodes them faithfully', () => {
    const width = 24;
    const height = 20;
    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i += 1) {
      const transparent = i % 7 === 0;

      rgba.set([i & 255, i >> 8, (i * 5) & 255, transparent ? 0 : 255], i * 4);
    }

    const colors = new Set<number>();

    for (let i = 0; i < width * height; i += 1) {
      if (i % 7 !== 0) colors.add(((i & 255) << 16) | ((i >> 8) << 8) | ((i * 5) & 255));
    }

    assert.ok(colors.size >= 300);

    for (const dither of ['none', 'floyd-steinberg'] as const) {
      const frame = quantizeFrame(rgba, width, height, dither);
      const size = frame.palette.length / 3;

      assert.ok(size <= 256);
      assert.equal(frame.transparentIndex, size - 1);
      assert.ok(frame.indices.every((index) => index < size));

      assert.ok(
        frame.indices.every((index, i) => (index === frame.transparentIndex) === (i % 7 === 0)),
      );

      const bytes = encodeGif([{ delayCs: 1, rgba }], {
        dither,
        height,
        loopCount: null,
        maxBytes: 1e7,
        width,
      });
      const decoded = decodeGif(bytes).frames[0]?.rgba ?? new Uint8ClampedArray();

      for (let i = 0; i < width * height; i += 1) {
        const index = frame.indices[i] ?? 0;
        const expected =
          i % 7 === 0 ? [0, 0, 0, 0] : [...frame.palette.slice(index * 3, index * 3 + 3), 255];

        assert.deepEqual([...decoded.slice(i * 4, i * 4 + 4)], expected);
      }
    }
  });

  it('keeps a full palette when the colors fill fewer 5-5-5 bins than slots', () => {
    const decode = (rgba: Uint8ClampedArray, width: number, dither: 'floyd-steinberg' | 'none') =>
      decodeGif(
        encodeGif([{ delayCs: 1, rgba }], {
          dither,
          height: 1,
          loopCount: null,
          maxBytes: 1e7,
          width,
        }),
      ).frames[0]?.rgba ?? new Uint8ClampedArray();
    // 256 grays and one transparent pixel: 32 bins for 255 slots.
    const grays = new Uint8ClampedArray(257 * 4);

    for (let gray = 0; gray < 256; gray += 1) grays.set([gray, gray, gray, 255], gray * 4);

    for (const dither of ['none', 'floyd-steinberg'] as const) {
      const frame = quantizeFrame(grays, 257, 1, dither);
      const decoded = decode(grays, 257, dither);

      assert.ok(frame.palette.length / 3 >= 200);
      assert.ok(frame.palette.length / 3 <= 256);
      assert.equal(decoded[256 * 4 + 3], 0);

      for (let gray = 0; gray < 256; gray += 1)
        assert.ok(Math.abs((decoded[gray * 4] ?? 0) - gray) <= 2, `${dither} gray ${gray}`);
    }

    // 300 colors that differ only in their low bits share 2 bins.
    const low = new Uint8ClampedArray(300 * 4);

    for (let i = 0; i < 300; i += 1) low.set([i % 8, (i >> 3) % 8, 8 + (i >> 6), 255], i * 4);

    assert.ok(quantizeFrame(low, 300, 1, 'none').palette.length / 3 >= 200);
  });

  it('quantizes a 480x270 photo-like frame with dithering within 2 seconds', () => {
    const width = 480;
    const height = 270;
    const rgba = new Uint8ClampedArray(width * height * 4);
    let seed = 7;

    for (let i = 0; i < width * height; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed >>> 24) % 24;

      rgba.set(
        [
          ((i % width) * 255) / width + noise,
          ((Math.floor(i / width) * 255) / height + noise) % 256,
          ((i * 3) % 256) / 2 + noise,
          255,
        ],
        i * 4,
      );
    }

    const start = performance.now();
    const frame = quantizeFrame(rgba, width, height, 'floyd-steinberg');

    assert.ok(frame.palette.length / 3 <= 256);
    assert.ok(performance.now() - start < 2000);
  });
});

describe('encodeGif', () => {
  const red = [255, 0, 0, 255];
  const green = [0, 255, 0, 255];
  const blue = [0, 0, 255, 255];
  const clear = [0, 0, 0, 0];

  it('round-trips three frames through decodeGif', () => {
    const frames = [
      { delayCs: 5, rgba: rgbaOf([red, green], 4, 2) },
      { delayCs: 10, rgba: rgbaOf([blue, clear, red], 4, 2) },
      { delayCs: 20, rgba: rgbaOf([green], 4, 2) },
    ];
    const bytes = encodeGif(frames, {
      dither: 'none',
      height: 2,
      loopCount: 0,
      maxBytes: 1e6,
      width: 4,
    });
    const result = decodeGif(bytes);

    assert.equal(result.frames.length, 3);
    assert.equal(result.loopCount, 0);

    assert.deepEqual(
      result.frames.map((f) => f.delayCs),
      [5, 10, 20],
    );

    assert.deepEqual(
      result.frames.map((f) => f.disposal),
      [2, 2, 2],
    );

    assert.deepEqual(
      result.frames.map((f) => f.transparentIndex === null),
      [true, false, true],
    );

    const [first, second, third] = frames;

    assert.ok(first && second && third);
    assert.deepEqual([...(result.frames[0]?.rgba ?? [])], [...first.rgba]);
    assert.deepEqual([...(result.frames[2]?.rgba ?? [])], [...third.rgba]);

    assert.deepEqual([...(result.frames[1]?.rgba ?? [])], [...second.rgba]);
  });

  it('omits the loop extension for null', () => {
    const bytes = encodeGif([{ delayCs: 1, rgba: rgbaOf([red], 1, 1) }], {
      dither: 'none',
      height: 1,
      loopCount: null,
      maxBytes: 1e6,
      width: 1,
    });

    assert.equal(decodeGif(bytes).loopCount, null);
  });

  it('throws when the output passes maxBytes', () => {
    const run = (): unknown =>
      encodeGif([{ delayCs: 1, rgba: rgbaOf([red], 8, 8) }], {
        dither: 'none',
        height: 8,
        loopCount: null,
        maxBytes: 40,
        width: 8,
      });

    assert.throws(run, /The GIF would exceed 100 MiB\./);
  });

  it('accepts exactly maxBytes and rejects one byte less, sync and async', async () => {
    const frame = { delayCs: 1, rgba: rgbaOf([red], 8, 8) };
    const options = (maxBytes: number) =>
      ({ dither: 'none', height: 8, loopCount: null, maxBytes, width: 8 }) as const;
    const length = encodeGif([frame], options(1e6)).length;

    const asyncFrames = async function* () {
      yield frame;
    };

    assert.equal(encodeGif([frame], options(length)).length, length);
    assert.throws(() => encodeGif([frame], options(length - 1)), /The GIF would exceed 100 MiB\./);
    assert.equal((await encodeGifAsync(asyncFrames(), options(length))).length, length);

    await assert.rejects(
      encodeGifAsync(asyncFrames(), options(length - 1)),
      /The GIF would exceed 100 MiB\./,
    );
  });
});
