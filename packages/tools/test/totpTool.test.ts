import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { totpTool } from '../src/catalog/crypto/totp/tool';

describe('totp tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of totpTool.samples ?? []) {
      const result = await totpTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes the first sample and keeps the secret out of it', async () => {
    const [sample] = totpTool.samples ?? [];
    const result = await totpTool.run({ fields: sample?.fields ?? {}, text: sample?.text ?? '' });

    assert.equal(result.summary, 'TOTP · SHA-1 · 8 digits · 30 s · 1 s left');
    assert.match(result.text, /^Code: 94287082\nPrevious: /);
    assert.match(result.text, /\nURI: otpauth:\/\/totp\//);
    assert.match(result.previewDataUri ?? '', /^data:image\/svg\+xml;base64,/);
  });

  it('reports validation results', async () => {
    const samples = totpTool.samples ?? [];
    const late = samples[5];
    const result = await totpTool.run({ fields: late?.fields ?? {}, text: late?.text ?? '' });
    const miss = await totpTool.run({
      fields: { ...late?.fields, window: '0' },
      text: late?.text ?? '',
    });

    assert.equal(result.text, 'Valid · step offset -1');
    assert.equal(result.summary, 'Valid · offset -1');
    assert.equal(miss.text, 'Invalid · no match within 0 steps each way');
    assert.equal(miss.summary, 'Invalid');
  });

  it('rejects invalid input', async () => {
    await assert.rejects(async () => totpTool.run({ fields: {}, text: '!!!' }), /Base32/);

    await assert.rejects(
      async () =>
        totpTool.run({
          fields: { code: '1', mode: 'validate', window: '11' },
          text: 'JBSWY3DPEHPK3PXP',
        }),
      /Window must be a whole number between 0 and 10\./,
    );
  });

  it('limits issuer length and survives an oversized QR payload', async () => {
    await assert.rejects(
      async () => totpTool.run({ fields: { issuer: 'i'.repeat(257) }, text: 'JBSWY3DPEHPK3PXP' }),
      /Issuer exceeds 256 characters\./,
    );

    await assert.rejects(
      async () => totpTool.run({ fields: { time: '-5' }, text: 'JBSWY3DPEHPK3PXP' }),
      /Time must be/,
    );

    const result = await totpTool.run({
      fields: { account: 'a'.repeat(256), issuer: '\u00e9'.repeat(256), time: '59' },
      text: 'JBSWY3DPEHPK3PXP',
    });

    assert.match(result.text, /^Code: \d{6}\n/);
  });
});
