import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { stripDiacriticsDetailed } from '@devtoolora/functions/text';

describe('scoped canonical accent removal', () => {
  it('removes Latin combining diacritics including marks outside U+0300–036F', () => {
    assert.equal(stripDiacriticsDetailed('Příliš žluťoučký kůň').text, 'Prilis zlutoucky kun');
    assert.equal(stripDiacriticsDetailed('Crème brûlée déjà vu').text, 'Creme brulee deja vu');
    assert.equal(stripDiacriticsDetailed('café / cafe\u0301').text, 'cafe / cafe');
    assert.equal(stripDiacriticsDetailed('a\u1AB0').text, 'a');
    const result = stripDiacriticsDetailed('é');

    assert.equal(result.inputCodePoints, 1);
    assert.equal(result.outputCodePoints, 1);
    assert.equal(result.removedMarks, 1);
    assert.equal(result.changedGraphemes, 1);
    assert.equal(result.nonAsciiCodePoints, 0);
  });

  it('preserves untargeted scripts, original decomposed spelling and emoji sequences exactly', () => {
    const source = 'α\u0301 ά عَرَبِيّ क् 가 ﬁ ♥️ 1️⃣ 👨‍👩‍👧‍👦 👍🏽';
    const result = stripDiacriticsDetailed(source);

    assert.equal(result.text, source);
    assert.equal(result.changedGraphemes, 0);
    assert.equal(result.removedMarks, 0);
    assert.ok(result.nonAsciiCodePoints > 0);
    assert.equal(stripDiacriticsDetailed('a\u034F\u0301').text, 'a\u034F');
    assert.equal(stripDiacriticsDetailed('\u0301a').text, '\u0301a');
    assert.equal(stripDiacriticsDetailed('^ ´ a\u20DD').text, '^ ´ a\u20DD');
  });

  it('distinguishes broad combining diacritics from removing all Unicode marks', () => {
    assert.equal(
      stripDiacriticsDetailed('ά بَ क् ♥️ 1️⃣', { scope: 'diacritics' }).text,
      'α ب क ♥️ 1️⃣',
    );

    assert.equal(stripDiacriticsDetailed('é ♥️ 1️⃣ 👨‍👩‍👧‍👦 👍🏽', { scope: 'marks' }).text, 'e ♥ 1 👨‍👩‍👧‍👦 👍🏽');
    assert.equal(stripDiacriticsDetailed('\u0301\u0308', { scope: 'diacritics' }).text, '');
    assert.equal(stripDiacriticsDetailed('\u034F', { scope: 'marks' }).text, '');
    assert.equal(stripDiacriticsDetailed('^ ´', { scope: 'diacritics' }).text, '^ ´');
  });

  it('does not promise transliteration or change raw spacing and terminators', () => {
    assert.equal(
      stripDiacriticsDetailed('Łódź Straße smør æsir Œuvre ﬁ').text,
      'Łodz Straße smør æsir Œuvre ﬁ',
    );

    assert.equal(stripDiacriticsDetailed('  čaj\r\ncafé\rkůň\n\t').text, '  caj\r\ncafe\rkun\n\t');
    assert.equal(stripDiacriticsDetailed(' \t\r\n').text, ' \t\r\n');
    assert.equal(stripDiacriticsDetailed('').text, '');
    assert.equal(stripDiacriticsDetailed('').inputCodePoints, 0);
    assert.equal(stripDiacriticsDetailed('hello').nonAsciiCodePoints, 0);
  });

  it('is idempotent in each scope', () => {
    const source = 'é a\u1AB0 α\u0301 بَ क् 가 ♥️ 1️⃣ Ł\r\n';

    for (const scope of ['latin', 'diacritics', 'marks'] as const) {
      const first = stripDiacriticsDetailed(source, { scope }).text;

      assert.equal(stripDiacriticsDetailed(first, { scope }).text, first);
    }
  });

  it('validates boundaries and accepts maximum-size valid Unicode input', () => {
    assert.equal(stripDiacriticsDetailed('é'.repeat(100_000)).text, 'e'.repeat(100_000));
    assert.equal(stripDiacriticsDetailed('😀'.repeat(50_000)).outputCodePoints, 50_000);
    assert.throws(() => stripDiacriticsDetailed('x'.repeat(100_001)), /100,000/);
    assert.throws(() => stripDiacriticsDetailed('\uD800'), /Unicode/);
    assert.throws(() => stripDiacriticsDetailed('\0'), /NUL/);
  });
});
