import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { normalizeUnicode } from '@devtoolora/functions/encoding';

describe('Unicode normalizer', () => {
  it('composes and decomposes accents', () => {
    const nfc = normalizeUnicode('cafe\u0301', 'NFC');

    assert.equal(nfc.text, 'caf\u00e9');
    assert.equal(nfc.changedGraphemes, 1);
    assert.equal(nfc.inputCodePoints, 5);
    assert.equal(nfc.outputCodePoints, 4);

    assert.deepEqual(nfc.changes[0], {
      after: '\u00e9',
      afterCodePoints: ['U+00E9'],
      before: 'e\u0301',
      beforeCodePoints: ['U+0065', 'U+0301'],
    });

    assert.equal(normalizeUnicode('caf\u00e9', 'NFD').text, 'cafe\u0301');
  });

  it('applies compatibility forms', () => {
    assert.equal(normalizeUnicode('\ufb01', 'NFKC').text, 'fi');
    assert.equal(normalizeUnicode('\u2460', 'NFKD').text, '1');
    assert.equal(normalizeUnicode('\ufb01', 'NFC').text, '\ufb01');
  });

  it('counts nothing for normalized or empty input', () => {
    assert.equal(normalizeUnicode('caf\u00e9', 'NFC').changedGraphemes, 0);
    assert.deepEqual(normalizeUnicode('', 'NFC').changes, []);
  });

  it('keeps only the first 100 changes but counts all', () => {
    const result = normalizeUnicode('e\u0301'.repeat(150), 'NFC');

    assert.equal(result.changedGraphemes, 150);
    assert.equal(result.changes.length, 100);
  });

  it('rejects invalid input', () => {
    assert.throws(() => normalizeUnicode('\uD800', 'NFC'), /unpaired surrogates/);
    assert.throws(() => normalizeUnicode('a\u0000', 'NFC'), /NUL/);
    assert.throws(() => normalizeUnicode('a'.repeat(100_001), 'NFC'), /100,000/);
  });

  it('returns exactly the whole-string normalization', () => {
    const sample = 'e\u0301\u1100\u1161 \ufb01 \u2460 a\u0323\u0307';

    for (const form of ['NFC', 'NFD', 'NFKC', 'NFKD'] as const)
      assert.equal(normalizeUnicode(sample, form).text, sample.normalize(form));
  });
});
