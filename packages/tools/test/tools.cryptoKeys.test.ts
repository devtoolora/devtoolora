import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const toolIds = [
  'aes-encrypt',
  'pbkdf2',
  'key-pair-generator',
  'ssh-key-generator',
  'totp',
  'jwk-to-pem',
  'checksum',
  'bip39',
  'diceware',
  'csr-decoder',
];

describe('crypto keys, KDFs and checksums', () => {
  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.equal(tool.samples?.length, 6, id);
      const fieldIds = new Set(tool.fields?.map((field) => field.id));

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

  it('keeps the alias map and the Crypto canonical count', () => {
    const tools = listBrowserWorkerTools();
    const aliases = Object.fromEntries(
      tools.filter((tool) => tool.aliasOf).map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries({
      'aes-decrypt': 'aes-encrypt',
      crc32: 'checksum',
      'pem-to-jwk': 'jwk-to-pem',
    }))
      assert.equal(aliases[id], target, id);

    for (const id of toolIds) {
      const tool = tools.find((entry) => entry.id === id);

      assert.equal(tool?.freshResults, true, id);

      assert.equal(
        tool?.sensitiveInput === true,
        ['aes-encrypt', 'pbkdf2', 'totp', 'jwk-to-pem', 'bip39', 'diceware'].includes(id),
        id,
      );
    }

    assert.equal(tools.filter((tool) => tool.category === 'Crypto' && !tool.aliasOf).length, 22);
  });
});
