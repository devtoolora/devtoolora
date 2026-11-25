import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { unicodeNormalizerTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('Unicode normalizer tool', () => {
  it('returns a JSON report for the NFD form', async () => {
    const result = await unicodeNormalizerTool.run({
      fields: { form: 'NFD', preview: 'report' },
      text: '\u00e9',
    });
    const report = JSON.parse(result.text);

    assert.equal(result.language, 'json');
    assert.equal(report.form, 'NFD');
    assert.deepEqual(report.changes[0].afterCodePoints, ['U+0065', 'U+0301']);
    assert.equal(report.counts.changedGraphemes, 1);
    assert.equal(result.artifact?.fileName, 'normalization-report.json');
  });

  it('returns text and tolerates empty input', async () => {
    const empty = await unicodeNormalizerTool.run({ fields: {}, text: '' });
    const plain = await unicodeNormalizerTool.run({ fields: {}, text: 'caf\u00e9' });

    assert.equal(empty.text, '');
    assert.equal(plain.artifact?.fileName, 'normalized.txt');
    assert.match(plain.summary ?? '', /0 graphemes changed/);
  });

  it('rejects an unknown form', async () => {
    await assert.rejects(
      async () => unicodeNormalizerTool.run({ fields: { form: 'NFX' }, text: 'a' }),
      /Choose NFC, NFD, NFKC or NFKD/,
    );
  });

  it('ships samples and content', () => {
    assert.equal(unicodeNormalizerTool.samples?.length, 6);
    assert.equal(contentOf(unicodeNormalizerTool).faq?.length, 4);
  });
});
