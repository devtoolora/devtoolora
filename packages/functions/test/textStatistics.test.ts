import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { textStatistics } from '@devtoolora/functions/text';

describe('Unicode text statistics', () => {
  it('distinguishes graphemes, code points, UTF-16 units and UTF-8 bytes without normalization', () => {
    const stats = textStatistics('é e\u0301 😀 👨‍👩‍👧‍👦');

    assert.equal(stats.graphemes, 7);
    assert.equal(stats.characters, 14);
    assert.equal(stats.utf16Units, 19);
    assert.equal(stats.bytes, 37);
    assert.equal(stats.words, 2);
    assert.equal(stats.letters, 2);
    assert.equal(stats.symbols, 5);
    assert.equal(stats.whitespace, 3);
  });

  it('counts line ending styles once and distinguishes empty from blank and trailing lines', () => {
    const stats = textStatistics('one\r\ntwo\rthree\nfour\u2028five\u2029');

    assert.equal(stats.lines, 6);
    assert.equal(stats.nonEmptyLines, 5);
    assert.equal(textStatistics('').lines, 0);
    assert.equal(textStatistics(' \t\n').lines, 2);
    assert.equal(textStatistics(' \t\n').nonEmptyLines, 0);
    assert.equal(textStatistics('one\n').lines, 2);
  });

  it('counts word-like Unicode segments and all decimal digit scripts', () => {
    assert.equal(textStatistics("don't stop 42").words, 3);
    assert.ok(textStatistics('你好世界。中文文本统计。', { locale: 'zh' }).words > 2);
    assert.ok(textStatistics('日本語の文章です。', { locale: 'ja' }).words > 1);
    assert.ok(textStatistics('ภาษาไทยไม่มีช่องว่าง', { locale: 'th' }).words > 1);
    assert.equal(textStatistics('42 ٤٢ Ⅻ').digits, 4);
    assert.equal(textStatistics('a\u0301\u200D').symbols, 0);
  });

  it('makes reading speed explicit and does not invent reading time for no words', () => {
    const stats = textStatistics(Array.from({ length: 200 }, () => 'word').join(' '));

    assert.equal(stats.readingTimeSeconds, 60);
    assert.equal(stats.readingTimeMinutes, 1);
    assert.equal(textStatistics('one', { wordsPerMinute: 100 }).readingTimeSeconds, 1);
    assert.equal(textStatistics('😀 !').readingTimeSeconds, 0);
    assert.equal(textStatistics('').readingTimeMinutes, 0);
    for (const wordsPerMinute of [0, 49, 1001, 200.5, NaN, Infinity])
      assert.throws(() => textStatistics('one', { wordsPerMinute }), /Reading speed/);
  });

  it('bounds work and rejects unpaired surrogates rather than misreporting encoded text', () => {
    assert.throws(() => textStatistics('a'.repeat(100_001)), /100,000/);
    assert.throws(() => textStatistics('\ud800'), /unpaired/);
    assert.throws(() => textStatistics('\udfff'), /unpaired/);
    assert.equal(textStatistics('😀').bytes, 4);
  });
});
