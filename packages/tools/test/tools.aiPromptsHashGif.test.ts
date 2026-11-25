import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { installFakeImageApis } from './fakeImageApis';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const toolIds = [
  'token-estimator',
  'text-chunker',
  'prompt-template-renderer',
  'jsonl-dataset-validator',
  'function-schema-builder',
  'bcrypt-hash',
  'gif-frame-extractor',
];
const aliases: Record<string, string> = {
  'gif-splitter': 'gif-frame-extractor',
  'text-splitter': 'text-chunker',
  'token-counter': 'token-estimator',
};
const links: [string, string][] = [
  ['json-lines-inspector', 'jsonl-dataset-validator'],
  ['jsonl-dataset-validator', 'json-lines-inspector'],
  ['json-schema-generator', 'function-schema-builder'],
  ['text-statistics', 'token-estimator'],
  ['pbkdf2', 'bcrypt-hash'],
  ['hash', 'bcrypt-hash'],
  ['image-tools', 'gif-frame-extractor'],
  ['sprite-sheet-generator', 'gif-frame-extractor'],
];

describe('AI prompt tools, bcrypt and GIF frames', () => {
  let restore = (): void => undefined;

  beforeEach(() => {
    restore = installFakeImageApis().restore;
  });

  afterEach(() => restore());

  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.equal(contentOf(tool).documentation?.length, 2, id);
      assert.equal(contentOf(tool).examples?.length, 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) <= 6, id);
      assert.equal(tool.samples?.length, 6, id);
      // fileName is supplied by the file picker, not declared as a field.
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
});
