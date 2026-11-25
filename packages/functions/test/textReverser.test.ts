import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { reverseText, reverseTextDetailed } from '@devtoolora/functions/text';

describe('Unicode-aware text reversal', () => {
  it('keeps combining marks, flags, skin tones and joined emoji together by default', () => {
    assert.equal(reverseText('Cafe\u0301 👩🏽‍💻'), '👩🏽‍💻 e\u0301faC');
    assert.equal(reverseText('A🇨🇿👨‍👩‍👧‍👦B'), 'B👨‍👩‍👧‍👦🇨🇿A');
    assert.equal(reverseTextDetailed('e\u0301😀').units, 2);
    assert.equal(reverseText('e\u0301', 'characters', { characterUnit: 'code-points' }), '\u0301e');
    assert.equal(reverseText('a😀b', 'characters', { characterUnit: 'code-points' }), 'b😀a');
    assert.equal(reverseText('a\r\nb'), 'b\r\na');
    assert.equal(reverseText('a\r\nb', 'characters', { characterUnit: 'code-points' }), 'b\n\ra');
  });

  it('reverses word blocks with explicit separator behavior and attached punctuation', () => {
    const source = '  one   two\tthree ';

    assert.equal(reverseText(source, 'words'), '  three   two\tone ');
    assert.equal(reverseText(source, 'words', { wordSpacing: 'reverse' }), ' three\ttwo   one  ');
    assert.equal(reverseText('Hello, world!', 'words'), 'world! Hello,');
    assert.equal(reverseText('one\u00A0two', 'words'), 'two\u00A0one');
    assert.equal(reverseText('你好世界', 'words'), '你好世界');
    assert.equal(reverseTextDetailed('one\n two', 'words').units, 2);
  });

  it('transforms line bodies independently without moving any terminator', () => {
    const source = 'abc\r\ndef\rghi\n';

    assert.equal(reverseText(source, 'characters', { scope: 'per-line' }), 'cba\r\nfed\rihg\n');

    assert.equal(
      reverseText('one two\r\nthree four\n', 'words', { scope: 'per-line' }),
      'two one\r\nfour three\n',
    );

    assert.equal(reverseTextDetailed('abc\r\ndef\n', 'characters', { scope: 'per-line' }).units, 6);
    assert.equal(reverseText('one\r\ntwo\rthree\n', 'lines'), 'three\r\ntwo\rone\n');
    assert.equal(reverseText('a\nb', 'lines'), 'b\na');
    assert.equal(reverseText('a\n', 'lines'), 'a\n');
    assert.equal(reverseText('\na', 'lines'), 'a\n');
    assert.equal(reverseText('a\n\nb\n', 'lines'), 'b\n\na\n');
  });

  it('preserves whitespace-only values and supports an exact empty result', () => {
    assert.equal(reverseText(''), '');
    assert.equal(reverseText('\t  \r\n', 'characters', { scope: 'per-line' }), '  \t\r\n');
    assert.equal(reverseText('  \t\n', 'words'), '  \t\n');
    assert.equal(reverseTextDetailed('', 'lines').units, 0);

    for (const source of ['abc', '😀abcdef', 'one\r\ntwo\n', 'hello   world\tthree']) {
      const reversed = reverseText(source, 'characters', { characterUnit: 'code-points' });

      assert.equal(reverseText(reversed, 'characters', { characterUnit: 'code-points' }), source);
    }
  });

  it('validates bounds and Unicode without silently trimming or selecting a different operation', () => {
    assert.equal(reverseTextDetailed('x'.repeat(100_000)).units, 100_000);
    assert.equal(reverseTextDetailed('x\n'.repeat(10_000), 'lines').units, 10_000);
    assert.throws(() => reverseText('x'.repeat(100_001)), /100,000/);
    assert.throws(() => reverseText('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => reverseText('x\0'), /NUL/);
    assert.throws(() => reverseText('\uD800'), /unpaired/);
  });
});
