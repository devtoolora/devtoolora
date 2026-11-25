import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { aesDecryptTool, aesEncryptTool } from '../src/catalog/crypto/aes-encrypt/tool';

describe('aes-encrypt tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of aesEncryptTool.samples ?? []) {
      const result = await aesEncryptTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes the first sample', async () => {
    const [sample] = aesEncryptTool.samples ?? [];
    const result = await aesEncryptTool.run({
      fields: sample?.fields ?? {},
      text: sample?.text ?? '',
    });

    assert.equal(
      result.summary,
      'AES-256-GCM · 10,000 PBKDF2 iterations · 13 plaintext bytes · 84 envelope characters',
    );
  });

  it('decrypts the pinned envelope as text and as a file', async () => {
    const [, , , decrypt, file] = aesEncryptTool.samples ?? [];
    const text = await aesEncryptTool.run({
      fields: decrypt?.fields ?? {},
      text: decrypt?.text ?? '',
    });
    const saved = await aesEncryptTool.run({ fields: file?.fields ?? {}, text: file?.text ?? '' });

    assert.equal(text.text, 'Hello, world!');
    assert.equal(text.summary, 'AES-256-GCM · 10,000 PBKDF2 iterations · 13 decrypted bytes');
    assert.equal(saved.text, 'Decrypted 13 bytes · saved as decrypted.bin');
    assert.equal(saved.artifact?.fileName, 'decrypted.bin');
    assert.equal(Buffer.from(saved.artifact?.base64 ?? '', 'base64').toString(), 'Hello, world!');
  });

  it('reports a failed decryption as a tool error', async () => {
    await assert.rejects(
      async () =>
        aesEncryptTool.run({
          fields: { mode: 'decrypt', passphrase: 'x' },
          text: 'AQAAJxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        }),
      (error) => error instanceof ToolError && /Decryption failed/.test(error.message),
    );
  });

  it('rejects text over the limit', async () => {
    await assert.rejects(
      async () => aesEncryptTool.run({ fields: { passphrase: 'x' }, text: 'a'.repeat(1_048_577) }),
      /Text exceeds 1,048,576 characters\./,
    );
  });

  it('keeps a leading BOM when decrypting to text', async () => {
    const bom = String.fromCharCode(0xfeff);
    const fields = { iterations: '1000', passphrase: 'pw' };
    const encrypted = await aesEncryptTool.run({ fields, text: `${bom}hi` });
    const decrypted = await aesEncryptTool.run({
      fields: { mode: 'decrypt', passphrase: 'pw' },
      text: encrypted.text,
    });

    assert.equal(decrypted.text, `${bom}hi`);
  });

  it('defines the decrypt alias', () => {
    assert.equal(aesDecryptTool.aliasOf, 'aes-encrypt');

    assert.equal(
      aesDecryptTool.fields?.find((field) => field.id === 'mode')?.defaultValue,
      'decrypt',
    );
  });
});
