import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  cleanWhitespace,
  cleanWhitespaceDetailed,
  type WhitespaceOptions,
} from '@devtoolora/functions/text';

const unchanged: WhitespaceOptions = {
  collapseBlankLines: false,
  collapseSpaces: false,
  trimLines: false,
  trimText: false,
  trimTrailing: false,
};
const safe: WhitespaceOptions = { ...unchanged, collapseBlankLines: true, trimTrailing: true };

describe('explicit whitespace cleaning', () => {
  it('preserves mixed terminators, indentation, Unicode and the final newline when disabled', () => {
    const text = '\uFEFF\t  😀\u00A0x  \r\n\t\t\r\n\rLast\u200B\n';
    const result = cleanWhitespaceDetailed(text, unchanged);

    assert.equal(result.text, text);
    assert.equal(result.changed, false);
    assert.deepEqual(result.before.lineEndings, { cr: 1, crlf: 2, lf: 1 });
    assert.equal(result.before.lines, 4);
    assert.equal(cleanWhitespaceDetailed('', unchanged).before.lines, 0);
    assert.equal(cleanWhitespaceDetailed('one\n', unchanged).after.lines, 1);
  });

  it('removes trailing spacing without changing indentation or interior spacing', () => {
    assert.equal(
      cleanWhitespace('  one   two \t\r\n\tthree  \r', safe),
      '  one   two\r\n\tthree\r',
    );

    assert.equal(
      cleanWhitespace('  one\t\t two\n\tthree', { ...safe, collapseSpaces: true }),
      '  one two\n\tthree',
    );

    assert.equal(cleanWhitespace('  one   two  '), 'one two');
    assert.equal(cleanWhitespace('  one  ', { ...safe, trimLines: true }), 'one');
    assert.equal(cleanWhitespace('First line  \n', unchanged), 'First line  \n');
  });

  it('limits blank physical lines without joining paragraphs or synthesizing a final newline', () => {
    assert.equal(cleanWhitespace('a\r\n \t\r\n\r\n\rb', safe), 'a\r\n\r\nb');
    assert.equal(cleanWhitespace('a\n\n\n', safe), 'a\n\n');
    assert.equal(cleanWhitespace('\n\n a \n\n', { ...safe, trimText: true }), 'a');
    assert.equal(cleanWhitespace('one\rtwo', { ...safe, lineEndings: 'crlf' }), 'one\r\ntwo');

    assert.equal(
      cleanWhitespace('one\r\ntwo\rthree\n', { ...safe, lineEndings: 'lf' }),
      'one\ntwo\nthree\n',
    );

    assert.equal(cleanWhitespace(' \t\r\n\r\n', { ...safe, trimText: true }), '');
  });

  it('normalizes Unicode spaces only explicitly and reports honest counts', () => {
    const source = 'a\u00A0b\u202Fc\u3000d\n';

    assert.equal(cleanWhitespace(source, safe), source);
    assert.equal(cleanWhitespace(source, { ...safe, normalizeUnicodeSpaces: true }), 'a b c d\n');

    assert.equal(
      cleanWhitespace('\uFEFFa\u200Bb\u2028c', { ...safe, normalizeUnicodeSpaces: true }),
      '\uFEFFa\u200Bb\u2028c',
    );

    const result = cleanWhitespaceDetailed('😀 \t\r\n', safe);

    assert.equal(result.before.codePoints, 5);
    assert.equal(result.after.codePoints, 3);
    assert.equal(result.before.spaces, 1);
    assert.equal(result.before.tabs, 1);
    assert.equal(result.after.tabs, 0);
  });

  it('is idempotent for combinations and validates bounds and Unicode', () => {
    const source = '\t  a   \u00A0b  \r\n\r\n \t\r\nc\r';

    for (let mask = 0; mask < 64; mask += 1) {
      const options: WhitespaceOptions = {
        collapseBlankLines: Boolean(mask & 1),
        collapseSpaces: Boolean(mask & 2),
        normalizeUnicodeSpaces: Boolean(mask & 4),
        trimLines: Boolean(mask & 8),
        trimText: Boolean(mask & 16),
        trimTrailing: Boolean(mask & 32),
      };
      const output = cleanWhitespace(source, options);

      assert.equal(cleanWhitespace(output, options), output);
    }

    assert.equal(cleanWhitespace('x'.repeat(100_000), unchanged).length, 100_000);
    assert.throws(() => cleanWhitespace('x'.repeat(100_001)), /100,000/);
    assert.throws(() => cleanWhitespace('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => cleanWhitespace('x\0'), /NUL/);
    assert.throws(() => cleanWhitespace('\uD800'), /unpaired/);
  });
});
