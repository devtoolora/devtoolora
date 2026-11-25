import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { layoutText, unwrapText, wrapText } from '@devtoolora/functions/text';

describe('explicit Unicode text layout', () => {
  it('wraps at ASCII gaps without losing indentation, padding or terminal newlines', () => {
    assert.equal(wrapText('one two three four', 10), 'one two\nthree four');
    assert.equal(wrapText('one  two\tthree  \n', 20), 'one  two\tthree  \n');
    assert.equal(wrapText('  one two three four\n', 10), '  one two\n  three\n  four\n');
    assert.equal(wrapText('\n \t\r\n', 1), '\n \t\r\n');
    assert.equal(wrapText('one\n', 80), 'one\n');
    assert.equal(wrapText(''), '');

    assert.equal(
      layoutText('  one   two\tthree  \n', { spacing: 'collapse', width: 20 }).text,
      '  one two three\n',
    );
  });

  it('keeps long tokens or splits complete graphemes rather than UTF-16 units', () => {
    const source = '👨‍👩‍👧‍👦🇨🇿e\u0301👍🏽\n';
    const result = layoutText(source, { longWords: 'break', width: 2 });

    assert.equal(result.text, '👨‍👩‍👧‍👦🇨🇿\ne\u0301👍🏽\n');
    assert.equal(result.longestLineGraphemes, 2);
    assert.equal(result.overWidthLines, 0);
    assert.equal(result.insertedBreaks, 1);
    assert.equal(layoutText(result.text, { longWords: 'break', width: 2 }).text, result.text);
    assert.equal(layoutText('abcdef', { width: 3 }).text, 'abcdef');
    assert.equal(layoutText('abcdef', { width: 3 }).overWidthLines, 1);
    assert.equal(layoutText('abcdef', { longWords: 'break', width: 3 }).text, 'abc\ndef');
    assert.equal(layoutText('中文文字', { longWords: 'break', width: 2 }).text, '中文\n文字');
    assert.equal(layoutText(' \u0301x', { longWords: 'break', width: 1 }).text, ' \u0301\nx');
    assert.equal(layoutText('one\u00A0two', { width: 3 }).text, 'one\u00A0two');
    assert.equal(layoutText('  abcdef', { longWords: 'break', width: 4 }).text, '  ab\n  cd\n  ef');
  });

  it('preserves existing mixed terminators and controls only inserted ones', () => {
    const result = layoutText('one two three\r\nfour five\rsix seven\n', { width: 7 });

    assert.equal(result.text, 'one two\r\nthree\r\nfour\rfive\rsix\nseven\n');
    assert.equal(result.inputLines, 3);
    assert.equal(result.outputLines, 6);
    assert.equal(result.insertedBreaks, 3);

    assert.equal(
      layoutText('one two three\r\n', { newLine: 'lf', width: 7 }).text,
      'one two\nthree\r\n',
    );

    assert.equal(
      layoutText('one two three', { newLine: 'crlf', width: 7 }).text,
      'one two\r\nthree',
    );

    assert.equal(layoutText('x\rone two three', { width: 7 }).text, 'x\rone two\rthree');
  });

  it('unwraps within paragraphs by default without replacing the final terminator', () => {
    const result = layoutText('one\r\ntwo\r\n\r\nthree\nfour\n', { mode: 'unwrap' });

    assert.equal(result.text, 'one two\r\n\r\nthree four\n');
    assert.equal(result.inputLines, 5);
    assert.equal(result.outputLines, 3);
    assert.equal(result.joinedBreaks, 2);
    assert.equal(unwrapText('one\ntwo'), 'one two');
    assert.equal(unwrapText('one\n'), 'one\n');
    assert.equal(unwrapText('\n \t\r\n'), '\n \t\r\n');

    assert.equal(
      layoutText('one\n\ntwo\n', { mode: 'unwrap', paragraphs: 'join' }).text,
      'one two\n',
    );

    assert.equal(
      layoutText('\none\n\n\ntwo\n\n', { mode: 'unwrap', paragraphs: 'join' }).text,
      'one two\n',
    );

    assert.equal(
      layoutText('one \n\n two\n', { mode: 'unwrap', paragraphs: 'join' }).text,
      'one   two\n',
    );

    assert.equal(
      layoutText('one\n\ntwo\n', { joinWith: 'none', mode: 'unwrap', paragraphs: 'join' }).text,
      'onetwo\n',
    );

    assert.equal(
      layoutText('one\n\ntwo\n', { mode: 'unwrap', paragraphs: 'join', spacing: 'collapse' }).text,
      'one two\n',
    );
  });

  it('makes unwrap edge cleanup and separator removal explicit', () => {
    assert.equal(unwrapText('one  \r\n  two\n'), 'one     two\n');

    assert.equal(
      layoutText('one  \r\n  two\n', { mode: 'unwrap', spacing: 'collapse' }).text,
      'one two\n',
    );

    assert.equal(
      layoutText('https://example.\n  test/path\n', {
        joinWith: 'none',
        mode: 'unwrap',
        spacing: 'collapse',
      }).text,
      'https://example.test/path\n',
    );

    assert.equal(
      layoutText('  one   two\n  three  \n', { mode: 'unwrap', spacing: 'collapse' }).text,
      '  one two three\n',
    );

    assert.equal(layoutText('a\nb', { joinWith: 'none', mode: 'unwrap' }).text, 'ab');
    assert.equal(layoutText('', { mode: 'unwrap' }).outputLines, 0);
  });

  it('never cuts original grapheme content while hard-wrapping long Unicode tokens', () => {
    for (const source of [
      '😀😀😀',
      'e\u0301e\u0301e\u0301',
      '🇨🇿🇩🇪🇫🇷',
      '👨‍👩‍👧‍👦👍🏽👩‍💻',
      'a\u00A0b\u200Bc',
    ]) {
      for (const width of [1, 2, 3]) {
        const result = layoutText(source, { longWords: 'break', width });

        assert.equal(result.text.replace(/\n/g, ''), source);
        assert.equal(result.overWidthLines, 0);
      }
    }
  });

  it('validates active widths, indentation, input limits and exact output budgets', () => {
    assert.equal(wrapText('x'.repeat(100_000)).length, 100_000);
    assert.equal(layoutText('x\n'.repeat(10_000)).inputLines, 10_000);

    assert.equal(
      layoutText('😀'.repeat(50_000), { longWords: 'break', width: 1 }).outputLines,
      50_000,
    );

    for (const width of [0, 1.5, NaN, 1_001])
      assert.throws(() => wrapText('x', width), /1 through 1,000/);
    assert.throws(() => layoutText('  x', { longWords: 'break', width: 2 }), /Indentation/);

    assert.throws(
      () => layoutText(' '.repeat(999) + 'x'.repeat(2_000), { longWords: 'break', width: 1_000 }),
      /1,000,000/,
    );

    assert.throws(() => wrapText('x'.repeat(100_001)), /100,000/);
    assert.throws(() => wrapText('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => wrapText('\uD800'), /Unicode/);
    assert.throws(() => unwrapText('\0'), /NUL/);
    assert.equal(layoutText('a\nb', { mode: 'unwrap', width: NaN }).text, 'a b');
  });
});
