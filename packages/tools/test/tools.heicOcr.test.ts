import { afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { contentOf } from './toolContent';
import { installFakeImageApis } from './fakeImageApis';
import { prepareHeic, prepareOcr } from '@devtoolora/functions/image';
import { loadRuntimeFilesForTest } from './runtimeFiles';
import { result } from './tools.helpers';

const toolIds = ['heic-converter', 'image-ocr'];
const aliases: Record<string, string> = {
  'heic-to-jpg': 'heic-converter',
  'heic-to-png': 'heic-converter',
  'image-to-text': 'image-ocr',
};
const links: [string, string][] = [
  ['heic-converter', 'image-tools'],
  ['heic-converter', 'batch-image-tools'],
  ['heic-converter', 'image-ocr'],
  ['image-ocr', 'heic-converter'],
  ['image-ocr', 'pdf-text-extractor'],
  ['image-ocr', 'image-tools'],
];

describe('HEIC converter and image OCR', () => {
  let restore = (): void => undefined;

  beforeAll(async () => {
    await loadRuntimeFilesForTest('heic');
    await loadRuntimeFilesForTest('ocr', ['eng', 'ces']);
    await prepareHeic();
    await prepareOcr();
  }, 60_000);

  beforeEach(() => {
    restore = installFakeImageApis().restore;
  });

  afterEach(() => restore());

  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) <= 6, id);
      assert.equal(tool.samples?.length, 6, id);
      const fieldIds = new Set([...(tool.fields ?? []).map((field) => field.id), 'fileName']);

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
          [],
          `${id}: ${sample.label}`,
        );

        const output = await result(id, sample.text ?? '', {
          ...Object.fromEntries(
            (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
          ),
          ...sample.fields,
          // The fake canvas cannot decode the palette PNG samples that Upscale redraws.
          ...(id === 'image-ocr' && { upscale: 'false' }),
        });

        assert.ok(output.text.length > 0, `${id}: ${sample.label}`);
        assert.ok((output.summary ?? '').length > 0, `${id}: ${sample.label}`);
      }
    }
  });

  it('keeps the alias map', () => {
    const actual = Object.fromEntries(
      listBrowserWorkerTools()
        .filter((tool) => tool.aliasOf)
        .map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries(aliases)) assert.equal(actual[id], target, id);
  });

  it('links these tools from related tools', () => {
    const tools = listBrowserWorkerTools();

    for (const [from, to] of links) {
      const tool = tools.find((entry) => entry.id === from);

      assert.ok(tool?.relatedToolIds?.includes(to), `${from} -> ${to}`);
    }
  });

  it('keeps the catalog totals', () => {
    const tools = listBrowserWorkerTools();

    assert.equal(tools.filter((tool) => !tool.aliasOf).length, 265);
    assert.equal(tools.length, 334);
  });
});
