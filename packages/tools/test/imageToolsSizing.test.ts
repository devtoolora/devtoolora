import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import {
  dataUri,
  decodeArtifact,
  decodePng,
  encodePng,
  installFakeImageApis,
  solidImage,
} from './fakeImageApis';

const png = (width: number, height: number, rgba: [number, number, number, number]): string =>
  dataUri(encodePng(solidImage(width, height, rgba)), 'image/png');

function run(id: string, fields: Record<string, string>, text = '') {
  const tool = browserImageCodeTools.find((entry) => entry.id === id);

  assert.ok(tool, id);

  return Promise.resolve(tool.run({ fields, text }));
}

const quad = png(120, 80, [10, 20, 30, 255]);
let restore = () => {};

describe('image tool sizing and validation', () => {
  beforeEach(() => ({ restore } = installFakeImageApis()));
  afterEach(() => restore());

  it('refuses an output over the canvas limit instead of a raw engine error', async () => {
    await assert.rejects(
      run('image-tools', {
        height: '100000',
        image: quad,
        operation: 'transform',
        width: '100000',
      }),
      /100,000 × 66,667 px, over the browser limit/,
    );
  });

  it('names the final size in the summary, which shows what Keep aspect ratio did', async () => {
    const summary = async (keepAspect: string) =>
      (
        await run('image-tools', {
          format: 'png',
          height: '60',
          image: quad,
          keepAspect,
          width: '60',
        })
      ).summary;

    assert.match((await summary('true')) ?? '', /transform complete\. 60 × 40 px\. /);
    assert.match((await summary('false')) ?? '', /transform complete\. 60 × 60 px\. /);
  });

  it('Keep aspect ratio fits Width and Height as a box; off stretches to exactly that size', async () => {
    const size = async (fields: Record<string, string>) => {
      const { height, width } = decodeArtifact(
        (await run('image-tools', { format: 'png', image: quad, ...fields })).artifact!.base64,
      );

      return [width, height];
    };

    assert.deepEqual(await size({ height: '60', width: '60' }), [60, 40]);
    assert.deepEqual(await size({ height: '60', keepAspect: 'false', width: '60' }), [60, 60]);
    assert.deepEqual(await size({ height: '60', keepAspect: 'true', width: '600' }), [90, 60]);
  });

  it('operations ignore the hidden fields of other operations', async () => {
    const result = await run('image-tools', {
      format: 'webp',
      image: quad,
      imageName: 'quad.png',
      operation: 'grayscale',
      width: '60',
    });
    const { height, width } = decodeArtifact(result.artifact!.base64);

    assert.deepEqual([width, height], [120, 80]);
    assert.equal(result.artifact!.fileName, 'quad.png');
  });

  it('refuses invalid colors, negative filter values and sizes, and a crop outside the image', async () => {
    const cases: Array<[string, Record<string, string>, RegExp]> = [
      ['image-tools', { operation: 'watermark', watermarkColor: 'notacolor' }, /color/i],
      ['image-tools', { brightness: '-1', operation: 'filters' }, /cannot be negative/],
      ['image-tools', { operation: 'transform', width: '-5' }, /greater than 0/],
      ['image-tools', { operation: 'transform', height: '0' }, /greater than 0/],
      [
        'image-tools',
        {
          cropHeight: '5',
          cropMode: 'custom',
          cropWidth: '5',
          cropX: '500',
          cropY: '500',
          operation: 'transform',
        },
        /inside the 120 × 80 image/,
      ],
    ];

    for (const [id, fields, message] of cases)
      await assert.rejects(run(id, { image: quad, ...fields }), message);

    await assert.rejects(
      run('web-pwa-icon-generator', { image: quad, themeColor: 'nope' }),
      /color/i,
    );
  });

  it('batch keeps its documented exact size when both Max width and Max height are set', async () => {
    const zip = await run('batch-image-tools', {
      contactSheet: 'false',
      format: 'png',
      height: '64',
      images: JSON.stringify([{ data: quad, name: 'a.png' }]),
      width: '64',
    });
    const image = decodePng(
      unzipSync(new Uint8Array(Buffer.from(zip.artifact!.base64, 'base64')))['image-001.png']!,
    );

    assert.deepEqual([image.width, image.height], [64, 64]);
  });
});
