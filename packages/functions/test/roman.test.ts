import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { convertRomanLines, fromRoman, toRoman } from '@devtoolora/functions/math';

describe('roman numerals', () => {
  it('converts both directions', () => {
    assert.equal(toRoman(2024), 'MMXXIV');
    assert.equal(toRoman(3999), 'MMMCMXCIX');
    assert.equal(fromRoman('mcmxciv'), 1994);
  });

  it('rejects non-standard and out-of-range values', () => {
    assert.throws(() => fromRoman('IIII'), /standard form is IV/);
    assert.throws(() => fromRoman('IC'), /standard form is XCIX/);
    assert.throws(() => fromRoman('MMMM'), /1-3,999/);
    assert.throws(() => toRoman(0), /1-3,999/);
  });

  it('converts lines and counts valid and invalid ones', () => {
    const r = convertRomanLines('2024\nXIV\nIIII\n0\n\nhello');

    assert.equal(
      r.text,
      '2024 → MMXXIV\nXIV → 14\nIIII → error: not a standard Roman numeral; standard form is IV.\n0 → error: Roman numerals cover 1-3,999.\n\nhello → error: use digits or the letters I, V, X, L, C, D and M.\n',
    );

    assert.deepEqual([r.valid, r.invalid], [2, 3]);
  });

  it('enforces the input limits', () => {
    assert.throws(() => convertRomanLines('1\n'.repeat(10_001)), /10,000 lines/);
    assert.throws(() => convertRomanLines(`1\n${'I'.repeat(65)}`), /Line 2.*64 characters/);
    assert.throws(() => convertRomanLines('  \n'), /input is required/);
  });
});
