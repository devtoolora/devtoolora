import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import type { ToolResult } from '@devtoolora/core';
import { assertZipLimit, prepareHeic } from '@devtoolora/functions/image';
import { processBatchImages } from '../src/catalog/imagesCodes/heic-converter/tool';
import { heicConverterTool, heicToJpgTool, heicToPngTool } from '../src/catalog/imagesCodes';
import {
  CORNERS_HEIC,
  MULTI_HEIC,
  TRUNCATED_HEIC,
} from '../../functions/test/fixtures/heicFixtures';
import { installFakeImageApis } from './fakeImageApis';
import { loadRuntimeFilesForTest } from './runtimeFiles';

let restore = (): void => undefined;

beforeAll(async () => {
  await loadRuntimeFilesForTest('heic');
  await prepareHeic();
}, 60_000);

beforeEach(() => {
  restore = installFakeImageApis().restore;
});

afterEach(() => restore());

const file = (name: string, base64: string) => ({ data: `data:image/heic;base64,${base64}`, name });
const run = async (files: unknown[], fields: Record<string, string> = {}): Promise<ToolResult> =>
  heicConverterTool.run({
    fields: {
      format: 'jpeg',
      images: 'primary',
      quality: '90',
      ...fields,
      files: JSON.stringify(files),
    },
    text: '',
  });
const fieldOf = (id: string) => heicConverterTool.fields?.find((field) => field.id === id);
const zipNames = (base64: string): string[] =>
  Object.keys(unzipSync(new Uint8Array(Buffer.from(base64, 'base64')))).sort();

describe('HEIC to JPG & PNG tool', () => {
  it('defines the runtime tool', () => {
    assert.equal(heicConverterTool.runtime, 'heic');
    assert.equal(heicConverterTool.autoRun, false);

    const filesField = fieldOf('files');

    assert.ok(filesField?.type === 'file');
    assert.equal(filesField.multiple, true);
    assert.equal(filesField.accept, '.heic,.heif,image/heic,image/heif');
    assert.equal(filesField.maxBytes, 50 * 1_048_576);

    const formatField = fieldOf('format');

    assert.ok(formatField?.type === 'select');
    assert.equal(formatField.defaultValue, 'jpeg');

    assert.deepEqual(
      formatField.options.map((option) => option.value),
      ['jpeg', 'png', 'webp'],
    );

    assert.equal(fieldOf('quality')?.defaultValue, '90');
    assert.deepEqual(fieldOf('quality')?.visibleWhen, { field: 'format', is: ['jpeg', 'webp'] });

    const imagesField = fieldOf('images');

    assert.ok(imagesField?.type === 'select');

    assert.deepEqual(
      imagesField.options.map((option) => option.value),
      ['primary', 'all'],
    );

    assert.equal(heicToPngTool.fields?.find((field) => field.id === 'format')?.defaultValue, 'png');

    assert.equal(
      heicToJpgTool.fields?.find((field) => field.id === 'format')?.defaultValue,
      'jpeg',
    );
  });

  it('converts one file to one image with a preview', async () => {
    const result = await run([file('IMG_1.heic', CORNERS_HEIC)]);

    assert.equal(result.artifact?.fileName, 'IMG_1.jpg');
    assert.match(result.previewDataUri ?? '', /^data:image\/jpeg/);
    assert.match(result.summary ?? '', /EXIF and GPS metadata were not copied\./);
  });

  it('zips several images of one file', async () => {
    const result = await run([file('multi.heic', MULTI_HEIC)], { images: 'all' });

    assert.equal(result.artifact?.fileName, 'multi-heic.zip');
    assert.deepEqual(zipNames(result.artifact?.base64 ?? ''), ['multi-2.jpg', 'multi.jpg']);
  });

  it('zips several files and renames colliding stems', async () => {
    const result = await run([file('a.heic', CORNERS_HEIC), file('a.HEIC', CORNERS_HEIC)]);

    assert.equal(result.artifact?.fileName, 'heic-converted.zip');
    assert.deepEqual(zipNames(result.artifact?.base64 ?? ''), ['a-2.jpg', 'a.jpg']);
  });

  it('reports a broken file and converts the rest', async () => {
    const result = await run([file('ok.heic', CORNERS_HEIC), file('broken.heic', TRUNCATED_HEIC)]);

    assert.equal(result.batch?.total, 2);
    assert.equal(result.batch?.succeeded, 1);
    assert.equal(result.batch?.failed[0]?.name, 'broken.heic');
    assert.ok(result.batch?.failed[0]?.message);
    assert.match(result.summary ?? '', /; 1 failed/);

    await assert.rejects(
      run([file('broken.heic', TRUNCATED_HEIC)]),
      /No image could be converted\. broken\.heic:/,
    );
  });

  it('enforces file limits before decoding', async () => {
    const many = Array.from({ length: 51 }, (_, index) => file(`${index}.heic`, CORNERS_HEIC));

    await assert.rejects(run(many), /50 files/);

    const big = file('big.heic', 'A'.repeat(Math.floor((41 * 1_048_576 * 4) / 3)));

    await assert.rejects(run(Array.from({ length: 5 }, () => big)), /200 MiB/);
  });

  it('limits the zip size', () => {
    assert.doesNotThrow(() => assertZipLimit(500 * 1_048_576));
    assert.throws(() => assertZipLimit(500 * 1_048_576 + 1), /500 MiB/);
  });

  it('stops converting once the zip limit is exceeded', async () => {
    const bytes = Uint8Array.from(Buffer.from(CORNERS_HEIC, 'base64'));
    const files = [1, 2, 3].map((n) => ({ bytes, mimeType: 'image/heic', name: `${n}.heic` }));
    const options = { format: 'png' as const, images: 'primary' as const, quality: 90 };

    await assert.rejects(processBatchImages(files, { ...options, zipLimit: 10 }), /zip limit/);
  });

  it('does not leak names of a failed file', async () => {
    const good = Uint8Array.from(Buffer.from(CORNERS_HEIC, 'base64'));
    const bad = Uint8Array.from(Buffer.from(TRUNCATED_HEIC, 'base64'));
    const files = ['a', 'a', 'a'].map((name, i) => ({
      bytes: i === 1 ? bad : good,
      mimeType: 'image/heic',
      name: `${name}.heic`,
    }));
    const result = await processBatchImages(files, {
      format: 'png',
      images: 'primary',
      quality: 90,
    });

    assert.deepEqual(
      result.outputs.map((output) => output.name),
      ['a.png', 'a-2.png'],
    );
  });
});
