import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { keyPairGeneratorTool } from '../src/catalog/crypto/key-pair-generator/tool';

describe('key pair generator tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of keyPairGeneratorTool.samples ?? []) {
      const result = await keyPairGeneratorTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes the first sample and writes PEM', async () => {
    const [sample] = keyPairGeneratorTool.samples ?? [];
    const result = await keyPairGeneratorTool.run({ fields: sample?.fields ?? {}, text: '' });

    assert.equal(result.summary, 'RSA 2048-bit · PEM');
    assert.match(result.text, /BEGIN PRIVATE KEY[\s\S]+\n\n-----BEGIN PUBLIC KEY/);
  });

  it('does not offer RSA 4096 samples and never autoRuns', () => {
    assert.equal(keyPairGeneratorTool.autoRun, false);

    assert.ok(
      !(keyPairGeneratorTool.samples ?? []).some((sample) => sample.fields?.size === '4096'),
    );
  });

  it('rejects an unknown algorithm', async () => {
    await assert.rejects(
      async () => keyPairGeneratorTool.run({ fields: { algorithm: 'dsa' }, text: '' }),
      /Choose RSA, ECDSA or Ed25519/,
    );
  });
});
