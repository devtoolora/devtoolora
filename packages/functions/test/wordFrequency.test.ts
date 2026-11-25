import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { countFrequency, type FrequencyOptions } from '@devtoolora/functions/text';

const words: FrequencyOptions = {
  caseSensitive: false,
  ignoreStopWords: false,
  limit: 50,
  minLength: 1,
  unit: 'words',
};

describe('countFrequency', () => {
  it('counts words case-insensitively with rounded percent', () => {
    const result = countFrequency('The cat and the hat. THE end', words);

    assert.deepEqual(result.rows[0], { value: 'the', count: 3, percent: 42.9 });
    assert.equal(result.total, 7);
    assert.equal(result.distinct, 5);
  });

  it('ignores stop words and keeps first-occurrence order on ties', () => {
    const result = countFrequency('The cat and the hat. THE end', {
      ...words,
      ignoreStopWords: true,
    });

    assert.deepEqual(
      result.rows.map((row) => row.value),
      ['cat', 'hat', 'end'],
    );
  });

  it('handles diacritics, case sensitivity and minimum length', () => {
    assert.deepEqual(countFrequency('Příliš žluťoučký kůň, příliš!', words).rows[0], {
      value: 'příliš',
      count: 2,
      percent: 50,
    });

    assert.equal(countFrequency('A a', { ...words, caseSensitive: true }).distinct, 2);
    assert.equal(countFrequency('a bb', { ...words, minLength: 2 }).total, 1);
  });

  it('counts characters by grapheme and skips whitespace', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    const result = countFrequency(`aa ${family}`, { ...words, unit: 'characters' });

    assert.deepEqual(
      result.rows.map((row) => [row.value, row.count]),
      [
        ['a', 2],
        [family, 1],
      ],
    );
  });

  it('survives lone surrogates and enforces limits', async () => {
    assert.equal(
      countFrequency('\uD800 \uD800', { ...words, unit: 'characters' }).rows[0]?.count,
      2,
    );

    await assert.rejects(async () => countFrequency('a', { ...words, limit: 0 }), /1 to 1,000/);
    await assert.rejects(async () => countFrequency('a', { ...words, limit: 1001 }), /1 to 1,000/);
    await assert.rejects(async () => countFrequency('a'.repeat(1_000_001), words), /1,000,000/);
  });

  it('keeps combining marks inside words and merges canonically equal forms', () => {
    const czech =
      'P\u0159\u00EDli\u0161 \u017Elu\u0165ou\u010Dk\u00FD k\u016F\u0148 p\u0159\u00EDli\u0161';
    const decomposed = countFrequency(czech.normalize('NFD'), words);

    assert.deepEqual(
      decomposed.rows.map(({ count, value }) => [value, count]),
      [
        ['p\u0159\u00EDli\u0161', 2],
        ['\u017Elu\u0165ou\u010Dk\u00FD', 1],
        ['k\u016F\u0148', 1],
      ],
    );

    assert.equal(decomposed.total, 4);

    const namaste = '\u0928\u092E\u0938\u094D\u0924\u0947';
    const hindi = `${namaste} \u0926\u0941\u0928\u093F\u092F\u093E ${namaste}`;

    assert.equal(countFrequency(hindi, words).total, 3);

    assert.equal(
      countFrequency('\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35 \u0E04\u0E23\u0E31\u0E1A', words).total,
      2,
    );

    assert.deepEqual(
      countFrequency('\u00E9 e\u0301', { ...words, unit: 'characters' }).rows.map(
        ({ count, value }) => [value, count],
      ),
      [['\u00E9', 2]],
    );
  });
});
