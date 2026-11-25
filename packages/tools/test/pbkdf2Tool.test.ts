import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { pbkdf2Tool } from '../src/catalog/crypto/pbkdf2/tool';

describe('pbkdf2 tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of pbkdf2Tool.samples ?? []) {
      const result = await pbkdf2Tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes the first sample', async () => {
    const [sample] = pbkdf2Tool.samples ?? [];
    const result = await pbkdf2Tool.run({ fields: sample?.fields ?? {}, text: '' });

    assert.equal(result.summary, 'PBKDF2-SHA-256 · 600,000 iterations · 32 bytes · hex');
  });

  it('matches RFC 6070 vector 1', async () => {
    const result = await pbkdf2Tool.run({
      fields: pbkdf2Tool.samples?.[1]?.fields ?? {},
      text: '',
    });

    assert.equal(result.text, '0c60c80f961f0e71f3a9b524af6012062fe037a6');
  });

  it('keeps findings out of the copied and saved key', async () => {
    const result = await pbkdf2Tool.run({
      fields: { iterations: '1000', password: 'p', salt: '' },
      text: '',
    });

    assert.match(result.text, /^[0-9a-f]{64}$/);
    assert.equal(Buffer.from(result.artifact?.base64 ?? '', 'base64').toString(), result.text);

    assert.match(
      result.summary ?? '',
      /· 2 medium: 1,000 iterations is below .* The salt is empty/,
    );
  });

  it('rejects invalid input', async () => {
    const base = { password: 'p', salt: 's' };

    await assert.rejects(
      async () => pbkdf2Tool.run({ fields: { ...base, iterations: '0' }, text: '' }),
      /between 1 and 10,000,000/,
    );

    await assert.rejects(
      async () =>
        pbkdf2Tool.run({ fields: { ...base, salt: 'abc', saltEncoding: 'hex' }, text: '' }),
      /Salt must be hex digits\./,
    );

    await assert.rejects(
      async () =>
        pbkdf2Tool.run({ fields: { ...base, salt: '***', saltEncoding: 'base64' }, text: '' }),
      /Salt must be valid Base64\./,
    );

    await assert.rejects(
      async () => pbkdf2Tool.run({ fields: { ...base, salt: 'a'.repeat(1_025) }, text: '' }),
      /Salt exceeds 1,024 characters\./,
    );
  });
});
