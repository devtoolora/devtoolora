import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cleanLines, type LineCleanupOptions } from '../src/text';

const base: LineCleanupOptions = {
  blankLines: 'remove',
  lineNumbers: 'keep',
  whitespaceIsBlank: true,
};

describe('line cleanup', () => {
  it('removes or collapses blank lines and keeps line endings', () => {
    assert.deepEqual(cleanLines('a\r\n\r\n\r\nb\n \nc', base), {
      blankLinesRemoved: 3,
      numbersRemoved: 0,
      text: 'a\r\nb\nc',
    });

    assert.equal(cleanLines('a\n\n\n\nb\n', { ...base, blankLines: 'collapse' }).text, 'a\n\nb\n');
    assert.equal(cleanLines('\n\na', { ...base, blankLines: 'collapse' }).text, '\na');
    assert.equal(cleanLines('a\n \nb', { ...base, whitespaceIsBlank: false }).text, 'a\n \nb');
    assert.equal(cleanLines('a\n\n', base).text, 'a\n');
    assert.equal(cleanLines('a\n\nb', { ...base, blankLines: 'keep' }).text, 'a\n\nb');
  });

  it('keeps CRLF, lone CR and an unterminated last line byte-exact', () => {
    assert.equal(cleanLines('a\r\nb\rc\r\n\r\nlast', base).text, 'a\r\nb\rc\r\nlast');

    assert.equal(
      cleanLines('a\r\n\r\n\r\nb\r\n', { ...base, blankLines: 'collapse' }).text,
      'a\r\n\r\nb\r\n',
    );

    assert.equal(cleanLines('a\r\nb', { ...base, blankLines: 'keep' }).text, 'a\r\nb');
    assert.equal(cleanLines('1. a\r\n2. b', { ...base, lineNumbers: 'remove' }).text, 'a\r\nb');
    assert.equal(cleanLines('', base).text, '');
  });

  it('removes line numbers only in known forms', () => {
    const numbers = { ...base, lineNumbers: 'remove' } as const;

    assert.deepEqual(cleanLines('1. one\n2) two\n3: three\n 4 | four\n5\tfive', numbers), {
      blankLinesRemoved: 0,
      numbersRemoved: 5,
      text: 'one\ntwo\nthree\nfour\nfive',
    });

    assert.equal(cleanLines('  1 const a\n\n  2 const b\n', numbers).text, 'const a\nconst b\n');

    assert.equal(
      cleanLines('2024 was good\nnot numbered', numbers).text,
      '2024 was good\nnot numbered',
    );

    assert.equal(cleanLines('1234567890. x', numbers).text, '1234567890. x');

    assert.equal(cleanLines('3.\n4)', { ...numbers, blankLines: 'keep' }).text, '\n');
    assert.equal(cleanLines('1 a\nno number\n3 c', numbers).text, '1 a\nno number\n3 c');

    assert.throws(() => cleanLines('a'.repeat(1_000_001), base), {
      message: 'Input is limited to 1,000,000 characters.',
    });
  });

  it('treats a bare number as a numbered blank line in the space form', () => {
    const numbers = { ...base, lineNumbers: 'remove' } as const;
    const text = '1 const a = 1;\n2\n3 const b = 2;\n';

    assert.deepEqual(cleanLines(text, { ...numbers, blankLines: 'keep' }), {
      blankLinesRemoved: 0,
      numbersRemoved: 3,
      text: 'const a = 1;\n\nconst b = 2;\n',
    });

    assert.deepEqual(cleanLines('  1 a\n  2  \n  3 b', numbers), {
      blankLinesRemoved: 1,
      numbersRemoved: 3,
      text: 'a\nb',
    });

    assert.deepEqual(cleanLines('1\n2\n3', numbers), {
      blankLinesRemoved: 0,
      numbersRemoved: 0,
      text: '1\n2\n3',
    });

    assert.equal(cleanLines('1 \n2 ', { ...numbers, blankLines: 'keep' }).text, '1 \n2 ');
  });

  it('keeps decimals, times and separators that are part of the text', () => {
    const numbers = { ...base, lineNumbers: 'remove' } as const;
    const text = '3.14 is pi\n10:30 standup\n1.2.3 x\n1|2|3\n12:34:56 INFO started\n5.5 million';

    assert.deepEqual(cleanLines(text, numbers), { blankLinesRemoved: 0, numbersRemoved: 0, text });
  });

  it('keeps numbers of ordinary sentences in the space form', () => {
    const numbers = { ...base, lineNumbers: 'remove' } as const;

    for (const text of [
      '2024 was good',
      '3 apples are red\n',
      '10 items\n20 items\n',
      '5 apples\n5 pears',
      '2 b\n1 a',
    ]) {
      assert.deepEqual(cleanLines(text, numbers), {
        blankLinesRemoved: 0,
        numbersRemoved: 0,
        text,
      });
    }

    assert.equal(cleanLines('10 items\n\n20 items\n', numbers).text, '10 items\n20 items\n');
    assert.equal(cleanLines('12 const a\n13 const b', numbers).text, 'const a\nconst b');
  });
});
