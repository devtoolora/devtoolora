import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import { SAMPLE_GPS_JPEG_DATA_URI } from '../src/catalog/imagesCodes/shared';
import { dataUri, encodePng, installFakeImageApis, solidImage } from './fakeImageApis';

const png = (width: number, height: number, rgba: [number, number, number, number]): string =>
  dataUri(encodePng(solidImage(width, height, rgba)), 'image/png');

function run(id: string, fields: Record<string, string>, text = '') {
  const tool = browserImageCodeTools.find((entry) => entry.id === id);

  assert.ok(tool, id);

  return Promise.resolve(tool.run({ fields, text }));
}

const scope = globalThis as Record<string, unknown>;
let restore = () => {};

describe('image tool accuracy', () => {
  beforeEach(() => {
    ({ restore } = installFakeImageApis());
    const decodePngOnly = scope.createImageBitmap as (blob: Blob) => Promise<unknown>;

    // The stand-in decodes only PNG; the sample JPEG needs just a size for its redraw.
    scope.createImageBitmap = (blob: Blob) =>
      blob.type === 'image/jpeg'
        ? Promise.resolve({ data: new Uint8ClampedArray(1024), height: 16, width: 16 })
        : decodePngOnly(blob);
  });

  afterEach(() => restore());

  it('dominant color counts pixels instead of reading the center pixel', async () => {
    const image = solidImage(100, 100, [255, 0, 0, 255]);

    for (let y = 48; y < 53; y += 1)
      for (let x = 48; x < 53; x += 1) image.data.set([0, 0, 255, 255], (y * 100 + x) * 4);

    const report = JSON.parse(
      (
        await run('image-tools', {
          image: dataUri(encodePng(image), 'image/png'),
          operation: 'dominant-color',
        })
      ).text,
    );

    assert.deepEqual(report, {
      hex: '#ff0000',
      palette: [
        { hex: '#ff0000', percent: 99.75 },
        { hex: '#0000ff', percent: 0.25 },
      ],
    });
  });

  it('dominant color ignores transparent pixels and refuses a fully transparent image', async () => {
    const image = solidImage(10, 10, [0, 0, 0, 0]);

    image.data.set([0, 200, 0, 255], 0);

    const report = JSON.parse(
      (
        await run('image-tools', {
          image: dataUri(encodePng(image), 'image/png'),
          operation: 'dominant-color',
        })
      ).text,
    );

    assert.deepEqual(report.palette, [{ hex: '#00c800', percent: 100 }]);

    await assert.rejects(
      run('image-tools', { image: png(4, 4, [0, 0, 0, 0]), operation: 'dominant-color' }),
      /fully transparent/,
    );
  });

  it('qr-code-reader samples each hold the payload they are named after', async () => {
    const tool = browserImageCodeTools.find((entry) => entry.id === 'qr-code-reader');
    const decoded = await Promise.all(
      (tool?.samples ?? []).map(async (sample) => [
        sample.label,
        JSON.parse((await run('qr-code-reader', sample.fields ?? {})).text).data,
      ]),
    );

    assert.deepEqual(Object.fromEntries(decoded), {
      'Contact card': 'MECARD:N:Lovelace,Ada;EMAIL:ada@example.com;;',
      'Email address': 'mailto:hello@example.com',
      'Phone number': 'tel:+420123456789',
      'Plain text': 'Hello from a QR code',
      'Website link': 'https://example.com/docs',
      'Wi-Fi network': 'WIFI:T:WPA;S:Guest Network;P:correct-horse;H:false;;',
    });
  });

  it('exif-remover shows EXIF dates as written, without a time zone', async () => {
    const report = JSON.parse(
      (
        await run('exif-remover', {
          image: SAMPLE_GPS_JPEG_DATA_URI,
          imageName: 'IMG.jpg',
        })
      ).text,
    );

    assert.equal(report.metadata.parsed.DateTimeOriginal, '2026-06-14T19:42:07');
  });

  it('pixel-diff counts a change in opacity alone', async () => {
    const result = await run('pixel-diff', {
      afterImage: png(40, 40, [0, 0, 0, 255]),
      beforeImage: png(40, 40, [0, 0, 0, 0]),
      threshold: '0',
    });

    assert.equal(JSON.parse(result.text).changedPixels, 1600);
  });
});
