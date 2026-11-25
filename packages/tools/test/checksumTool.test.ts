import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { checksumTool, crc32Tool } from '../src/catalog/crypto/checksum/tool';

describe('checksum tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of checksumTool.samples ?? []) {
      const result = await checksumTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('formats all and single outputs', async () => {
    const all = await checksumTool.run({ fields: {}, text: '123456789' });
    const one = await checksumTool.run({ fields: { algorithm: 'crc32' }, text: '123456789' });

    assert.equal(all.summary, '9 checksums · 9 bytes');
    assert.equal(all.text.split('\n')[0], 'CRC-32              CBF43926  3421780262');
    assert.ok(all.text.split('\n').includes('CRC-16/CCITT-FALSE  29B1      10673'));
    assert.equal(all.text.split('\n').length, 9);
    assert.equal(one.text, 'CBF43926\n3421780262');
    assert.equal(one.summary, 'CRC-32 · 9 bytes · CBF43926');
  });

  it('prefers a file and enforces the text limit before encoding', async () => {
    const file = `data:text/plain;base64,${Buffer.from('123456789').toString('base64')}`;
    const result = await checksumTool.run({
      fields: { algorithm: 'crc32', file },
      text: 'ignored',
    });

    assert.equal(result.text.split('\n')[0], 'CBF43926');

    await assert.rejects(
      async () => checksumTool.run({ fields: {}, text: 'a'.repeat(1_048_577) }),
      /Text exceeds 1,048,576 characters\./,
    );
  });

  it('rejects an unknown algorithm', async () => {
    await assert.rejects(
      async () => checksumTool.run({ fields: { algorithm: 'crc64' }, text: 'a' }),
      (error) => error instanceof ToolError && /Choose an algorithm/.test(error.message),
    );
  });

  it('defines the crc32 alias', () => {
    const field = crc32Tool.fields?.find((item) => item.id === 'algorithm');

    assert.equal(crc32Tool.aliasOf, 'checksum');
    assert.equal(field?.defaultValue, 'crc32');
  });
});
