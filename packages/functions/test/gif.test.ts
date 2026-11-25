import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import { decodeGif, parseFrameSelection } from '@devtoolora/functions/image';
import { streamGif } from '../src/image/gif';
import type { GifFrame } from '@devtoolora/functions/image';
import { buildGif } from './fixtures/gifBuilder';
import type { GifBuilderFrame } from './fixtures/gifBuilder';
import {
  animatedGif,
  fullTableGif,
  fullTableRgbaSha256,
  interlacedGif,
  localPaletteGif,
} from './fixtures/gifFixtures';

const palette: [number, number, number][] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];

function fromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function hex(frame: GifFrame): string {
  return Buffer.from(frame.rgba).toString('hex');
}

function rejectsWith(run: () => unknown, message: string): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof FunctionError);
    assert.equal(error.message, message);

    return true;
  });
}

function tinyFrames(count: number): GifBuilderFrame[] {
  return Array.from({ length: count }, () => ({ height: 1, pixels: [0], width: 1 }));
}

describe('decodeGif fixtures', () => {
  it('composites disposals 1/2/3 with transparency and reads timing and the loop', () => {
    const result = decodeGif(fromBase64(animatedGif.base64));

    assert.deepEqual(result.frames.map(hex), animatedGif.frames);

    assert.deepEqual(
      result.frames.map(({ delayCs, disposal, index, playedMs, transparentIndex }) => ({
        delayCs,
        disposal,
        index,
        playedMs,
        transparentIndex,
      })),
      [
        { delayCs: 0, disposal: 1, index: 1, playedMs: 100, transparentIndex: 3 },
        { delayCs: 1, disposal: 2, index: 2, playedMs: 100, transparentIndex: 0 },
        { delayCs: 25, disposal: 3, index: 3, playedMs: 250, transparentIndex: 1 },
      ],
    );

    assert.deepEqual(result.frames[2]?.rect, { height: 3, left: 1, top: 1, width: 3 });
    assert.equal(result.loopCount, 0);
    assert.equal(result.frameCount, 3);
    assert.equal(result.width, 4);
    assert.equal(result.height, 4);
    assert.equal(result.truncatedAt, null);
    assert.deepEqual(result.notes, []);
  });

  it('deinterlaces the four passes of a GIF87a frame', () => {
    const result = decodeGif(fromBase64(interlacedGif.base64));
    const [frame] = result.frames;

    assert.deepEqual(result.frames.map(hex), interlacedGif.frames);
    assert.equal(result.loopCount, null);
    assert.equal(frame?.transparentIndex, null);
    assert.equal(frame?.disposal, 0);
    assert.equal(frame?.playedMs, 100);
  });

  it('reads local and global palettes, the ANIMEXTS loop and skips comments', () => {
    const result = decodeGif(fromBase64(localPaletteGif.base64));

    assert.deepEqual(result.frames.map(hex), localPaletteGif.frames);

    assert.deepEqual(
      result.frames.map((frame) => frame.localPalette),
      [true, true, false],
    );

    assert.deepEqual(
      result.frames.map((frame) => frame.playedMs),
      [100, 500, 20],
    );

    assert.equal(result.loopCount, 3);
  });

  it('continues at 12 bits when the table fills without a clear code', () => {
    const [frame] = decodeGif(fullTableGif()).frames;

    assert.ok(frame);
    assert.equal(createHash('sha256').update(frame.rgba).digest('hex'), fullTableRgbaSha256);
  });

  it('restores the previous state after disposal 3', () => {
    const bytes = buildGif({
      frames: [
        { disposal: 1, height: 1, pixels: [0, 0, 0], width: 3 },
        { disposal: 3, height: 1, pixels: [1, 1], width: 2 },
        { disposal: 3, height: 1, left: 1, pixels: [2, 2], width: 2 },
        { height: 1, left: 2, pixels: [3], width: 1 },
      ],
      height: 1,
      palette,
      width: 3,
    });

    assert.deepEqual(decodeGif(bytes).frames.map(hex), [
      'ff0000ffff0000ffff0000ff',
      '00ff00ff00ff00ffff0000ff',
      'ff0000ff0000ffff0000ffff',
      'ff0000ffff0000ffffffffff',
    ]);
  });

  it('returns only the selected frames, composited over the earlier ones', () => {
    const bytes = fromBase64(animatedGif.base64);
    const selected = decodeGif(bytes, { frames: [2] });

    assert.deepEqual(selected.frames.map(hex), [animatedGif.frames[1]]);
    assert.equal(selected.frames[0]?.index, 2);
    assert.deepEqual(decodeGif(bytes, { frames: [] }).frames, []);
    assert.equal(decodeGif(bytes, { frames: [] }).frameCount, 3);

    rejectsWith(
      () => decodeGif(bytes, { frames: [4] }),
      'Frame 4 does not exist; the GIF has 3 frames.',
    );
  });
});

describe('decodeGif errors and recovery', () => {
  it('rejects data that is not a GIF', () => {
    for (const bytes of [new Uint8Array(), Buffer.from('GIF88a\x01\x00\x01\x00\x00\x00\x00;')])
      rejectsWith(() => decodeGif(new Uint8Array(bytes)), 'This is not a GIF file.');
  });

  it('rejects a GIF without frames', () => {
    rejectsWith(
      () => decodeGif(buildGif({ frames: [], height: 1, palette, width: 1 })),
      'The GIF has no frames.',
    );
  });

  it('rejects a code past the next free entry and bad code sizes', () => {
    // Codes of 3 bits: clear (4), index 0, then 7 while the next free entry is 6.
    const corrupt = { data: [0xc4, 0x01], height: 1, width: 2 };
    const frames = [{ height: 1, pixels: [0, 0], width: 2 }, corrupt];

    rejectsWith(
      () => decodeGif(buildGif({ frames, height: 1, palette, width: 2 })),
      'Frame 2 has corrupt image data.',
    );

    for (const minCodeSize of [1, 9]) {
      const bytes = buildGif({
        frames: [{ height: 1, minCodeSize, pixels: [0], width: 1 }],
        height: 1,
        palette,
        width: 1,
      });

      rejectsWith(() => decodeGif(bytes), 'Frame 1 has corrupt image data.');
    }
  });

  it('keeps the frames before a truncated one', () => {
    const bytes = fromBase64(animatedGif.base64);
    const result = decodeGif(bytes.subarray(0, bytes.length - 3));

    assert.deepEqual(result.frames.map(hex), animatedGif.frames.slice(0, 2));
    assert.equal(result.truncatedAt, 3);
    assert.equal(result.frameCount, 2);
    assert.equal(decodeGif(bytes.subarray(0, bytes.length - 1)).truncatedAt, null);
    rejectsWith(() => decodeGif(bytes.subarray(0, 40)), 'The GIF has no frames.');
  });

  it('decodes a complete frame that lacks only its closing 0x00 byte', () => {
    const bytes = fromBase64(animatedGif.base64);
    const result = decodeGif(bytes.subarray(0, bytes.length - 2));

    assert.equal(result.truncatedAt, null);
    assert.deepEqual(result.frames.map(hex), animatedGif.frames);

    assert.deepEqual(result.notes, [
      'Frame 3 is missing its closing 0x00 byte; it was decoded anyway.',
    ]);
  });

  it('notes an unknown extension block and skips it', () => {
    const bytes = fromBase64(animatedGif.base64);
    const unknown = [0x21, 0x77, 0x01, 0x05, 0x00, 0x3b];
    const patched = new Uint8Array([...bytes.subarray(0, bytes.length - 1), ...unknown]);
    const result = decodeGif(patched);

    assert.deepEqual(result.frames.map(hex), animatedGif.frames);
    assert.deepEqual(result.notes, ['Extension block 0x77 after frame 3 was ignored.']);
  });

  it('ignores extra pixels and leaves missing pixels undrawn with a note', () => {
    const decode = (pixels: number[]) =>
      decodeGif(
        buildGif({ frames: [{ height: 2, pixels, width: 2 }], height: 2, palette, width: 2 }),
      );
    const extra = decode([0, 1, 2, 3, 0, 1]);
    const missing = decode([0, 1, 2]);

    assert.equal(hex(extra.frames[0] as GifFrame), 'ff0000ff00ff00ff0000ffffffffffff');
    assert.deepEqual(extra.notes, []);
    assert.equal(hex(missing.frames[0] as GifFrame), 'ff0000ff00ff00ff0000ffff00000000');
    assert.deepEqual(missing.notes, ['Frame 1 is missing pixels; they were not drawn.']);
  });

  it('clips a rectangle outside the screen with a note', () => {
    const result = decodeGif(
      buildGif({
        frames: [{ height: 2, left: 1, pixels: [0, 1, 2, 3], top: 1, width: 2 }],
        height: 2,
        palette,
        width: 2,
      }),
    );

    assert.equal(hex(result.frames[0] as GifFrame), '000000000000000000000000ff0000ff');
    assert.deepEqual(result.frames[0]?.rect, { height: 2, left: 1, top: 1, width: 2 });
    assert.deepEqual(result.notes, ['Frame 1 extends outside the screen; it was clipped.']);
  });
});

describe('decodeGif limits', () => {
  it('limits the screen to 1-4,096 px per side', () => {
    const screen = (width: number, height: number) =>
      buildGif({ frames: tinyFrames(1), height, palette, width });

    assert.equal(decodeGif(screen(4096, 1)).width, 4096);
    assert.equal(decodeGif(screen(1, 4096)).height, 4096);

    for (const [width, height] of [
      [4097, 1],
      [1, 4097],
      [0, 1],
      [1, 0],
    ] as const)
      rejectsWith(
        () => decodeGif(screen(width, height)),
        'GIF screen must be 1-4,096 px per side.',
      );
  });

  it('limits the GIF to 1,000 frames', () => {
    const gif = (count: number) =>
      buildGif({ frames: tinyFrames(count), height: 1, palette, width: 1 });

    assert.equal(decodeGif(gif(1000)).frames.length, 1000);
    rejectsWith(() => decodeGif(gif(1001)), 'The GIF has more than 1,000 frames.');
  });

  it('limits decoding to 200,000,000 pixels before allocating', () => {
    const message = 'Decoding would need more than 200,000,000 pixels; select fewer frames.';
    const big = buildGif({ frames: tinyFrames(12), height: 4096, palette, width: 4096 });

    rejectsWith(() => decodeGif(big), message);
    assert.equal(decodeGif(big, { frames: [1] }).frames.length, 1);

    // 250 × 200 screen: 199,950,000 + 50,000 pixels is exactly at the limit.
    const wide = (height: number) =>
      buildGif({
        frames: [{ height, pixels: [0], width: 50_000 }, ...tinyFrames(1)],
        height: 200,
        palette,
        width: 250,
      });

    assert.equal(decodeGif(wide(3999)).frames.length, 2);
    rejectsWith(() => decodeGif(wide(4000)), message);

    rejectsWith(
      () => decodeGif(wide(4001), { frames: [1] }),
      'Frame 1 is larger than 200,000,000 pixels.',
    );
  });
});

describe('decodeGif allocation', () => {
  it('allocates no frame buffer when the pixel limit is exceeded', () => {
    const Original = Uint8ClampedArray;
    const sizes: number[] = [];

    class Spy extends Original {
      constructor(...args: ConstructorParameters<typeof Uint8ClampedArray>) {
        super(...args);
        sizes.push(this.length);
      }
    }

    const big = buildGif({ frames: tinyFrames(12), height: 4096, palette, width: 4096 });

    vi.stubGlobal('Uint8ClampedArray', Spy);

    try {
      rejectsWith(
        () => decodeGif(big),
        'Decoding would need more than 200,000,000 pixels; select fewer frames.',
      );

      assert.equal(Math.max(0, ...sizes) < 4096 * 4096 * 4, true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('streamGif', () => {
  it('composites every selected frame into the one working canvas', () => {
    // 96 1×1 frames on a 1080p screen: a copy per frame would hold about 760 MB at once.
    const stream = streamGif(
      buildGif({ frames: tinyFrames(96), height: 1080, palette, width: 1920 }),
    );
    const buffers = new Set<Uint8ClampedArray>();
    let count = 0;

    for (const frame of stream.frames) {
      buffers.add(frame.rgba);
      count += 1;
    }

    assert.equal(count, 96);
    assert.equal(buffers.size, 1);
  });
});

describe('parseFrameSelection', () => {
  it('reads blank as all frames and sorts unique numbers and ranges', () => {
    assert.deepEqual(parseFrameSelection('', 3), [1, 2, 3]);
    assert.deepEqual(parseFrameSelection('  ', 2), [1, 2]);
    assert.deepEqual(parseFrameSelection('1-3, 15', 20), [1, 2, 3, 15]);
    assert.deepEqual(parseFrameSelection('5,1,1-2', 5), [1, 2, 5]);
    assert.deepEqual(parseFrameSelection(' 4 - 4 ', 5), [4]);
  });

  it('rejects frames past the end and malformed selections', () => {
    rejectsWith(
      () => parseFrameSelection('12', 10),
      'Frame 12 does not exist; the GIF has 10 frames.',
    );

    rejectsWith(
      () => parseFrameSelection('3-12', 10),
      'Frame 12 does not exist; the GIF has 10 frames.',
    );

    rejectsWith(() => parseFrameSelection('0', 1), 'Frame 0 does not exist; the GIF has 1 frame.');

    rejectsWith(
      () => parseFrameSelection('1-99999999999999999999', 1000),
      'Frame 99999999999999999999 does not exist; the GIF has 1,000 frames.',
    );

    for (const text of ['a', '1-', '-3', '1,,2', '2,', '3-1', '1.5', '1-2-3'])
      rejectsWith(
        () => parseFrameSelection(text, 10),
        'Frames must be numbers or ranges like 1-10,15.',
      );
  });
});
