import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { extractGifFrames } from '../../functions/src/image';
import { gifFrameExtractorTool, gifSplitterTool } from '../src/catalog/imagesCodes';
import { buildGif } from '../../functions/test/fixtures/gifBuilder';
import { animatedGif } from '../../functions/test/fixtures/gifFixtures';
import { decodePng, installFakeImageApis } from './fakeImageApis';

let restore = (): void => undefined;

beforeEach(() => {
  restore = installFakeImageApis().restore;
});

afterEach(() => restore());

const toUri = (bytes: Uint8Array): string =>
  `data:image/gif;base64,${Buffer.from(bytes).toString('base64')}`;
const hex = (data: Uint8ClampedArray): string => Buffer.from(data).toString('hex');
const run = async (file: string, frames = '', fileName = 'x.gif'): Promise<ToolResult> =>
  gifFrameExtractorTool.run({ fields: { file, fileName, frames }, text: '' });
const unzip = (base64?: string) => unzipSync(new Uint8Array(Buffer.from(base64 ?? '', 'base64')));
const gifWith = (count: number, loop?: { count: number }): string =>
  toUri(
    buildGif({
      frames: Array.from({ length: count }, () => ({
        delayCs: 10,
        height: 1,
        pixels: [0],
        width: 1,
      })),
      height: 1,
      loop,
      palette: [
        [0, 0, 0],
        [255, 255, 255],
      ],
      width: 1,
    }),
  );

describe('GIF frame extractor tool', () => {
  it('declares itself with auto run and fresh results, also on the alias', () => {
    for (const tool of [gifFrameExtractorTool, gifSplitterTool]) {
      assert.equal(tool.autoRun, true);
      assert.equal(tool.freshResults, true);
      assert.deepEqual(tool.resultActions, ['save', 'copy']);
    }

    assert.equal(gifSplitterTool.id, 'gif-splitter');
    assert.equal(gifSplitterTool.aliasOf, 'gif-frame-extractor');
  });

  it('zips composited PNG frames and a timing file', async () => {
    const result = await run(`data:image/gif;base64,${animatedGif.base64}`);
    const files = unzip(result.artifact?.base64);

    assert.equal(result.artifact?.fileName, 'x-frames.zip');

    assert.deepEqual(Object.keys(files).sort(), [
      'x-001.png',
      'x-002.png',
      'x-003.png',
      'x-frames.json',
    ]);

    animatedGif.frames.forEach((expected, index) =>
      assert.equal(
        hex(decodePng(files[`x-00${index + 1}.png`] ?? new Uint8Array()).data),
        expected,
      ),
    );

    const report = JSON.parse(Buffer.from(files['x-frames.json'] ?? []).toString('utf8'));

    assert.deepEqual(Object.keys(report), ['frames', 'height', 'loopCount', 'width']);

    assert.deepEqual(Object.keys(report.frames[0]).sort(), [
      'delayCs',
      'disposal',
      'index',
      'localPalette',
      'playedMs',
      'rect',
      'transparentIndex',
    ]);

    assert.equal(result.text, JSON.stringify(report, null, 2));
    assert.match(result.previewDataUri ?? '', /^data:image\/png;base64,/);
    assert.equal(result.summary, '3 frames · 4×4 · 0.45 s per loop · loops forever.');
  });

  it('exports only the selected frames', async () => {
    const files = unzip(
      (await run(`data:image/gif;base64,${animatedGif.base64}`, '2')).artifact?.base64,
    );

    assert.deepEqual(Object.keys(files).sort(), ['x-002.png', 'x-frames.json']);
  });

  it('rejects a frame past the end and a non-GIF', async () => {
    await assert.rejects(
      () => run(`data:image/gif;base64,${animatedGif.base64}`, '4'),
      (error) => error instanceof ToolError && error.message.includes('Frame 4 does not exist'),
    );

    await assert.rejects(
      () => run('data:image/gif;base64,AAAAAAAAAAAA'),
      (error) => error instanceof ToolError && error.message === 'This is not a GIF file.',
    );
  });

  it('adds notes found while streaming frames to the summary', async () => {
    const clipped = toUri(
      buildGif({
        frames: [{ height: 2, left: 1, pixels: [0, 0, 0, 0], top: 1, width: 2 }],
        height: 2,
        palette: [
          [0, 0, 0],
          [255, 255, 255],
        ],
        width: 2,
      }),
    );

    assert.match(
      (await run(clipped)).summary ?? '',
      /Frame 1 extends outside the screen; it was clipped\.$/,
    );
  });

  it('describes loop counts', async () => {
    assert.match((await run(gifWith(2))).summary ?? '', /0\.20 s per loop · plays once\.$/);
    assert.match((await run(gifWith(2, { count: 0 }))).summary ?? '', /loops forever\.$/);
    assert.match((await run(gifWith(2, { count: 3 }))).summary ?? '', /loops 3 times\.$/);
    assert.match((await run(gifWith(1))).summary ?? '', /^1 frame · /);
  });

  it('pads names to three digits', async () => {
    const files = unzip((await run(gifWith(12), '2,12')).artifact?.base64);

    assert.deepEqual(Object.keys(files).sort(), ['x-002.png', 'x-012.png', 'x-frames.json']);
  });

  it('keeps frames before a cut-off one and says so', async () => {
    const bytes = Buffer.from(animatedGif.base64, 'base64');
    const cut = toUri(bytes.subarray(0, bytes.length - 20));
    const result = await run(cut);

    assert.match(result.summary ?? '', /The file ends inside frame \d+; frames 1-\d+ were kept\./);
  });

  it('refuses a zip over the limit', async () => {
    const bytes = new Uint8Array(Buffer.from(animatedGif.base64, 'base64'));

    await assert.rejects(
      () => extractGifFrames(bytes, 'x', '', 100),
      (error) =>
        error instanceof Error &&
        error.message === 'The zip would exceed 200 MiB; select fewer frames.',
    );
  });

  it('encodes a 1080p GIF of 96 tiny frames without copying a frame per selection', async () => {
    const screenBytes = 1920 * 1080 * 4;
    const slice = vi.spyOn(Uint8ClampedArray.prototype, 'slice');
    const bytes = buildGif({
      frames: Array.from({ length: 96 }, () => ({ height: 1, pixels: [1], width: 1 })),
      height: 1080,
      palette: [
        [0, 0, 0],
        [255, 255, 255],
      ],
      width: 1920,
    });

    try {
      const result = await extractGifFrames(bytes, 'big', '');

      assert.equal(Object.keys(unzipSync(result.zip)).length, 97);

      assert.equal(
        slice.mock.contexts.filter((buffer) => (buffer as Uint8ClampedArray).length === screenBytes)
          .length,
        0,
      );
    } finally {
      slice.mockRestore();
    }
  }, 60_000);

  it('strips path separators and the extension from the name', async () => {
    const result = await run(gifWith(1), '', '..\\a/b.v2.gif');

    assert.equal(result.artifact?.fileName, '..ab.v2-frames.zip');
    assert.equal((await run(gifWith(1), '', '.gif')).artifact?.fileName, 'frames-frames.zip');
  });
});
