import assert from 'node:assert/strict';
import type { ToolResult } from '@devtoolora/core';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { decodeGif } from '../../functions/src/image';
import { checkFrameBudget, gifSizeText } from '../../functions/src/image/gifMaker';
import { gifMakerTool, imagesToGifTool } from '../src/catalog/imagesCodes';
import { encodePng, installFakeImageApis, solidImage, type RawImage } from './fakeImageApis';

let restore = (): void => undefined;

beforeEach(() => {
  restore = installFakeImageApis().restore;
});

afterEach(() => restore());

type Entry = { bytes: Uint8Array; mimeType?: string; name: string };

const png = (width: number, height: number, rgba: [number, number, number, number]): Uint8Array =>
  encodePng(solidImage(width, height, rgba));
const files = (entries: Entry[]): string =>
  JSON.stringify(
    entries.map(({ bytes, mimeType = 'image/png', name }) => ({
      data: `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`,
      name,
    })),
  );
const three = (): Entry[] =>
  (['01', '02', '03'] as const).map((name, index) => ({
    bytes: png(4, 2, [index * 100, 50, 200, 255]),
    name: `${name}.png`,
  }));
const run = async (entries: Entry[], fields: Record<string, string> = {}): Promise<ToolResult> =>
  gifMakerTool.run({ fields: { files: files(entries), ...fields }, text: '' });
const gifOf = (result: { artifact?: { base64: string } }) =>
  decodeGif(new Uint8Array(Buffer.from(result.artifact?.base64 ?? '', 'base64')));

const padded = (bytes: Uint8Array, length: number): Uint8Array => {
  const out = new Uint8Array(length);

  out.set(bytes);

  return out;
};

describe('Images to GIF tool', () => {
  it('declares itself and its alias', () => {
    assert.equal(gifMakerTool.autoRun, false);
    assert.equal(gifMakerTool.freshResults, true);
    assert.equal(imagesToGifTool.aliasOf, 'gif-maker');
    assert.equal(imagesToGifTool.fields, gifMakerTool.fields);
  });

  it('builds three frames with size, delay and summary', async () => {
    const result = await run(three(), { delay: '105' });
    const gif = gifOf(result);

    assert.equal(result.artifact?.fileName, '01.gif');
    assert.equal(result.artifact?.mimeType, 'image/gif');
    assert.match(result.previewDataUri ?? '', /^data:image\/gif;base64,/);
    assert.equal(gif.frames.length, 3);
    assert.equal(gif.width, 4);
    assert.equal(gif.height, 2);
    assert.equal(gif.frames[0]?.delayCs, 11);
    assert.equal(gif.loopCount, 0);

    assert.match(
      result.summary ?? '',
      /^3 frames · 4×2 · 0\.33 s per loop · loops forever · \d+\.\d kB\.$/,
    );

    assert.match(result.text.split('\n')[0] ?? '', /^Frame 1 · 01\.png · 110 ms · 1 color$/);
  });

  it('prints the size in kB below 1,000,000 bytes and in MB from there', () => {
    assert.equal(gifSizeText(1234), '1.2 kB');
    assert.equal(gifSizeText(999_000), '999.0 kB');
    assert.equal(gifSizeText(1_000_000), '1.0 MB');
    assert.equal(gifSizeText(999_949), '999.9 kB');
    assert.equal(gifSizeText(999_950), '1.0 MB');
    assert.equal(gifSizeText(999_999), '1.0 MB');
    assert.equal(gifSizeText(1_340_000), '1.3 MB');
  });

  it("reports each frame's palette size without the transparent entry", async () => {
    // 400 distinct opaque colors and one transparent pixel: 255 palette colors plus transparency.
    const data = new Uint8ClampedArray(401 * 4);

    for (let i = 1; i < 401; i += 1) data.set([i & 255, (i >> 8) * 100, 7, 255], i * 4);

    const image: RawImage = { data, height: 1, width: 401 };
    const result = await run([
      { bytes: encodePng(image), name: 'many.png' },
      { bytes: png(4, 2, [1, 2, 3, 255]), name: 'one.png' },
    ]);

    assert.deepEqual(result.text.split('\n'), [
      'Frame 1 · many.png · 100 ms · 255 colors',
      'Frame 2 · one.png · 100 ms · 1 color',
    ]);
  });

  it('accepts images by their bytes, whatever the MIME type says', async () => {
    for (const mimeType of ['application/octet-stream', 'image/jpg', 'image/x-ms-bmp', ''])
      assert.equal(
        gifOf(await run([{ bytes: png(2, 2, [9, 9, 9, 255]), mimeType, name: 'a.bin' }])).frames
          .length,
        1,
        mimeType,
      );

    await assert.rejects(
      run([{ bytes: new TextEncoder().encode('not an image'), name: 'notes.png' }]),
      /notes\.png is not a PNG, JPEG, WebP, BMP or GIF image\./,
    );
  });

  it('labels the delay in ms and starts its range at 20', () => {
    const delay = gifMakerTool.fields?.find((field) => field.id === 'delay');

    assert.equal(delay?.label, 'Delay (ms)');
    assert.equal(delay?.type === 'number' ? delay.range?.min : undefined, 20);
  });

  it('keeps transparent borders with disposal 2 for contain', async () => {
    const result = await run(
      [
        { bytes: png(8, 2, [255, 0, 0, 255]), name: 'a.png' },
        { bytes: png(2, 8, [0, 255, 0, 255]), name: 'b.png' },
      ],
      { height: '8', width: '8' },
    );
    const gif = gifOf(result);

    assert.ok(gif.frames.every((frame) => frame.disposal === 2));
    assert.equal(gif.frames[0]?.rgba[3], 0);
    assert.equal(gif.frames[0]?.rgba[(4 * 8 + 4) * 4 + 3], 255);
    assert.equal(gif.frames[1]?.rgba[3], 0);
  });

  it('fills the background and rejects a translucent one', async () => {
    const gif = gifOf(await run(three(), { background: '#ff0000', height: '4', width: '4' }));

    assert.deepEqual([...(gif.frames[0]?.rgba.subarray(0, 4) ?? [])], [255, 0, 0, 255]);

    await assert.rejects(
      run(three(), { background: 'rgba(0,0,0,0.5)' }),
      /Background must be transparent or an opaque color\./,
    );
  });

  it('maps repeat to the loop count', async () => {
    assert.equal(gifOf(await run(three(), { repeat: 'count', repeatCount: '1' })).loopCount, null);
    assert.equal(gifOf(await run(three(), { repeat: 'count', repeatCount: '3' })).loopCount, 2);
    assert.equal(gifOf(await run(three(), { repeat: 'count', repeatCount: '100' })).loopCount, 99);
    await assert.rejects(run(three(), { repeat: 'count', repeatCount: '101' }));

    assert.match(
      (await run(three(), { repeat: 'count', repeatCount: '3' })).summary ?? '',
      /plays 3 times/,
    );
  });

  it('checks delays at their bounds and names both counts on a mismatch', async () => {
    await run(three(), { delay: '20' });
    await run(three(), { delay: '60000' });
    await assert.rejects(run(three(), { delay: '19' }), /20 to 60,000 ms/);
    await assert.rejects(run(three(), { delay: '60001' }), /20 to 60,000 ms/);
    assert.equal(gifOf(await run(three(), { delays: '20,300,40' })).frames[1]?.delayCs, 30);
    await assert.rejects(run(three(), { delays: '100,200' }), /2 delays for 3 frames/);
  });

  it('checks the size bounds', async () => {
    const one = [{ bytes: png(2, 2, [1, 2, 3, 255]), name: 'a.png' }];

    assert.equal(gifOf(await run(one, { height: '1', width: '1024' })).width, 1024);
    await assert.rejects(run(one, { width: '1025' }), /between 1 and 1,024/);
    await assert.rejects(run(one, { width: '0' }));
    assert.equal(gifOf(await run(one, { height: '1024', width: '1' })).height, 1024);
    await assert.rejects(run(one, { height: '1025' }), /between 1 and 1,024/);

    await assert.rejects(
      run([{ bytes: png(1, 2, [1, 2, 3, 255]), name: 'a.png' }], { width: '1024' }),
      /The size would be 1024×2048 px; each side must be 1 to 1,024\./,
    );

    assert.equal(
      gifOf(await run([{ bytes: png(4, 2, [1, 2, 3, 255]), name: 'a.png' }], { width: '8' }))
        .height,
      4,
    );
  });

  it('checks the file count and sizes at their bounds', async () => {
    const tiny = png(1, 1, [1, 2, 3, 255]);
    const many = (count: number): Entry[] =>
      Array.from({ length: count }, (_, index) => ({ bytes: tiny, name: `${index}.png` }));

    assert.equal(gifOf(await run(many(300))).frames.length, 300);
    await assert.rejects(run(many(301)), /between 1 and 300/);

    const tenMiB = 10 * 1_048_576;

    await run([{ bytes: padded(tiny, tenMiB), name: 'big.png' }]);

    await assert.rejects(
      run([{ bytes: padded(tiny, tenMiB + 1), name: 'big.png' }]),
      /larger than 10 MiB/,
    );

    const big = { bytes: padded(tiny, tenMiB), name: 'big.png' };

    await run(Array.from({ length: 20 }, () => big));
    await assert.rejects(run(Array.from({ length: 21 }, () => big)), /200 MiB/);
  });

  it('limits frames times pixels', async () => {
    checkFrameBudget(100, 1000, 1000);
    assert.throws(() => checkFrameBudget(100, 1000, 1001), /100,000,000/);

    await assert.rejects(
      run(
        Array.from({ length: 101 }, () => ({ bytes: png(1, 1, [1, 2, 3, 255]), name: 'a.png' })),
        {
          height: '1000',
          width: '1000',
        },
      ),
      /100,000,000/,
    );
  });

  it('runs every sample', async () => {
    for (const sample of gifMakerTool.samples ?? []) {
      const result = await gifMakerTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.ok((result.summary?.length ?? 0) > 0, sample.label);
    }
  });
});
