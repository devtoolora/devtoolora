import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import type { ToolResult } from '@devtoolora/core';
import { spriteSheetGeneratorTool } from '../src/catalog/imagesCodes';
import {
  dataUri,
  decodeArtifact,
  encodePng,
  installFakeImageApis,
  solidImage,
} from './fakeImageApis';

let restore = () => {};

beforeEach(() => {
  restore = installFakeImageApis().restore;
});

afterEach(() => restore());

const file = (name: string, width: number, height: number) => ({
  data: dataUri(encodePng(solidImage(width, height, [255, 0, 0, 255])), 'image/png'),
  name,
});

const run = async (images: unknown[], fields: Record<string, string> = {}): Promise<ToolResult> =>
  spriteSheetGeneratorTool.run({ fields: { images: JSON.stringify(images), ...fields }, text: '' });

describe('sprite-sheet-generator', () => {
  it('returns png, css and json artifacts with a data uri preview', async () => {
    const output = await run([file('a.png', 32, 32), file('b.png', 16, 16)], {
      layout: 'horizontal',
    });
    const artifacts = [output.artifact, ...(output.artifacts ?? [])].map((a) => a?.fileName);

    assert.deepEqual(artifacts.sort(), ['sprite.css', 'sprite.json', 'sprite.png']);

    assert.equal(
      output.summary,
      '2 images packed into 54\u00d736 px (horizontal layout, 2 px padding).',
    );

    assert.ok(output.previewDataUri?.startsWith('data:image/png;base64,'));
    assert.match(output.text, /\.sprite-b \{/);

    const sheet = decodeArtifact(output.artifact?.base64 ?? '');

    assert.deepEqual([sheet.width, sheet.height], [54, 36]);

    const json = JSON.parse(
      Buffer.from(
        output.artifacts?.find((a) => a.fileName === 'sprite.json')?.base64 ?? '',
        'base64',
      ).toString(),
    );

    assert.deepEqual(json.frames['sprite-b'], { h: 16, source: 'b.png', w: 16, x: 36, y: 2 });
    assert.deepEqual(json.meta, { image: 'sprite.png', pixelRatio: 1, size: { h: 36, w: 54 } });
  });

  it('rejects too many images', async () => {
    const one = file('a.png', 1, 1);

    await assert.rejects(run(Array.from({ length: 201 }, () => one)), /between 1 and 200/);
  });

  it('names an oversized image', async () => {
    await assert.rejects(run([file('huge.png', 4097, 1)]), /huge\.png.*4096/);
  });

  it('states the sheet size it would have needed', async () => {
    const wide = file('w.png', 4000, 1);

    await assert.rejects(run([wide, wide, wide], { layout: 'horizontal' }), /12008 × 5 px/);
  });

  it('names an undecodable file', async () => {
    await assert.rejects(
      run([{ data: 'data:image/png;base64,AAAA', name: 'broken.png' }]),
      /broken\.png could not be decoded/,
    );
  });

  it('rejects an invalid class prefix', async () => {
    await assert.rejects(
      run([file('a.png', 1, 1)], { classPrefix: '1x' }),
      /Class prefix must start with a lowercase letter/,
    );
  });

  it('keeps one bitmap open at a time and builds no canvas for an oversize sheet', async () => {
    const scope = globalThis as Record<string, unknown>;
    const decode = scope.createImageBitmap as (blob: Blob) => Promise<ImageBitmap>;
    const Canvas = scope.OffscreenCanvas as new (width: number, height: number) => object;
    let open = 0;
    let peak = 0;
    let canvases = 0;

    scope.createImageBitmap = async (blob: Blob) => {
      const bitmap = await decode(blob);
      const close = bitmap.close.bind(bitmap);

      open += 1;
      peak = Math.max(peak, open);

      bitmap.close = () => {
        open -= 1;
        close();
      };

      return bitmap;
    };

    scope.OffscreenCanvas = class extends Canvas {
      constructor(width: number, height: number) {
        super(width, height);
        canvases += 1;
      }
    };

    try {
      const wide = file('w.png', 4000, 1);

      await assert.rejects(run([wide, wide, wide], { layout: 'horizontal' }), /12008 × 5 px/);
      assert.equal(canvases, 0);
      assert.equal(open, 0);

      await run([file('a.png', 3, 3), file('b.png', 4, 4), file('c.png', 5, 5)]);
      assert.equal(peak, 1);
      assert.equal(open, 0);
      assert.equal(canvases, 1);
    } finally {
      scope.createImageBitmap = decode;
      scope.OffscreenCanvas = Canvas;
    }
  });
});
