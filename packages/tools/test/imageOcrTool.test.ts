import assert from 'node:assert/strict';
import { afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import { prepareOcr } from '@devtoolora/functions/image';
import { imageOcrTool, imageToTextTool } from '../src/catalog/imagesCodes';
import { installFakeImageApis } from './fakeImageApis';
import { loadRuntimeFilesForTest } from './runtimeFiles';
import { fieldsOf } from './tools.helpers';

let restore = (): void => undefined;

beforeAll(async () => {
  await loadRuntimeFilesForTest('ocr');
  await prepareOcr();
}, 60_000);

beforeEach(() => {
  restore = installFakeImageApis().restore;
});

afterEach(() => restore());

const sampleFields = (index: number): Record<string, string> =>
  imageOcrTool.samples?.[index]?.fields ?? {};

describe('Image to Text (OCR) tool', () => {
  it('defines the runtime tool', () => {
    const fields = fieldsOf(imageOcrTool) ?? [];

    assert.equal(imageOcrTool.runtime, 'ocr');
    assert.equal(imageOcrTool.autoRun, false);

    assert.deepEqual(fields.map((field) => field.id).sort(), [
      'file',
      'language',
      'layout',
      'upscale',
    ]);

    assert.equal(
      fields.find((field) => field.id === 'file')?.accept,
      '.png,.jpg,.jpeg,.webp,.bmp,.gif',
    );

    assert.equal(fields.find((field) => field.id === 'file')?.maxBytes, 20 * 1_048_576);
    assert.equal(fields.find((field) => field.id === 'language')?.defaultValue, 'eng');
    assert.equal(fields.find((field) => field.id === 'layout')?.defaultValue, 'auto');
    assert.equal(fields.find((field) => field.id === 'upscale')?.defaultValue, 'false');
  });

  it('returns text, a JSON artifact and a summary', async () => {
    const result = await imageOcrTool.run({ fields: sampleFields(0), text: '' });
    const report = JSON.parse(Buffer.from(result.artifact?.base64 ?? '', 'base64').toString());

    assert.match(result.text, /Dev Toolora 2026/);
    assert.equal(result.artifact?.fileName, 'devtoolora-ocr.json');
    assert.equal(result.artifact?.mimeType, 'application/json');
    assert.deepEqual(Object.keys(report).sort(), ['language', 'lines', 'meanConfidence', 'words']);
    assert.ok(result.summary);
  });

  it('rejects an unknown language and layout', async () => {
    await assert.rejects(
      async () => imageOcrTool.run({ fields: { ...sampleFields(0), language: 'deu' }, text: '' }),
      /Language/,
    );

    await assert.rejects(
      async () => imageOcrTool.run({ fields: { ...sampleFields(0), layout: 'x' }, text: '' }),
      /Layout/,
    );
  });

  it('alias keeps canonical defaults', () => {
    assert.equal(imageToTextTool.fields, imageOcrTool.fields);
    assert.equal(imageToTextTool.aliasOf, 'image-ocr');
  });
});
