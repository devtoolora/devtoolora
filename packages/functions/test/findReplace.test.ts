import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { findReplace, findReplaceDetailed } from '@devtoolora/functions/text';

describe('bounded explicit replacement', () => {
  it('treats literal patterns and dollar/backslash replacements literally', () => {
    assert.equal(findReplace('a.b.c', '.', '$&'), 'a$&b$&c');
    assert.equal(findReplace('[x] [x]', '[x]', '$1\\n'), '$1\\n $1\\n');
    assert.equal(findReplace('TOOLS tools', 'tools', 'world'), 'world world');

    assert.equal(
      findReplace('TOOLS tools', 'tools', 'world', { caseSensitive: true }),
      'TOOLS world',
    );

    assert.equal(findReplace('K K k', 'k', 'x'), 'x x x');
    assert.equal(findReplaceDetailed('aaa', 'aa', 'X').text, 'Xa');
    assert.equal(findReplace('a', 'a', 'aa'), 'aa');
    assert.equal(findReplace('a a', 'a', 'x', { occurrence: 'first' }), 'x a');
  });

  it('uses collected regex captures with native JavaScript token semantics', () => {
    const cases = [
      { pattern: '(\\w+), (\\w+)', replacement: '$2 $1', text: 'Lovelace, Ada\nHopper, Grace' },
      { pattern: '(?<key>\\w+)=(?<value>\\w+)', replacement: '$<key>: $<value>', text: 'a=1 b=2' },
      { pattern: '(a)?(b)', replacement: "$1/$2/$3/$12/$$/$&/$`/$'", text: 'b ab' },
      { pattern: '^ERROR:', replacement: 'WARN:', text: 'ERROR: one\nERROR: two' },
    ];

    for (const sample of cases) {
      const options = { flags: 'mu', regex: true };

      assert.equal(
        findReplace(sample.text, sample.pattern, sample.replacement, options),
        sample.text.replace(new RegExp(sample.pattern, 'gimu'), sample.replacement),
      );
    }

    assert.equal(
      findReplace('id=123', '\\d+', '$1', { regex: true, replacementMode: 'literal' }),
      'id=$1',
    );

    assert.equal(findReplace('A a', '(a)', '$1!', { occurrence: 'first', regex: true }), 'A! a');
  });

  it('handles Unicode zero-width matches, deletion, empty sources and unchanged operations', () => {
    assert.equal(findReplace('😀😀', '(?=😀)|$', '|', { regex: true }), '|😀|😀|');
    assert.equal(findReplace('', '', '|', { regex: true }), '|');
    assert.equal(findReplace('😀', '', '|', { regex: true }), '|😀|');
    assert.equal(findReplace('remove', 'remove'), '');
    assert.equal(findReplace('', 'x', 'y'), '');
    assert.equal(findReplace('no match', 'xyz', 'y'), 'no match');
    const same = findReplaceDetailed('x x', 'x', 'x');

    assert.equal(same.count, 2);
    assert.equal(same.changed, false);
    assert.equal(findReplace('😀', '.', 'x', { occurrence: 'first', regex: true }), 'x');

    assert.throws(
      () => findReplace('😀', '.', 'x', { flags: '', occurrence: 'first', regex: true }),
      /unpaired/,
    );
  });

  it('preserves unmatched spacing and raw endings but permits intentional newline replacement', () => {
    assert.equal(findReplace(' one \r\ntwo\rone\n', 'one', 'ONE'), ' ONE \r\ntwo\rONE\n');
    assert.equal(findReplace('one\r\ntwo\rone\n', '\r\n', '\n'), 'one\ntwo\rone\n');
    assert.equal(findReplace('a,b', ',', '\n'), 'a\nb');

    assert.equal(
      findReplaceDetailed('a', 'a', 'b', { flags: 'bad', replacementMode: 'tokens' }).text,
      'b',
    );
  });

  it('enforces input, match and output limits without partial text', () => {
    assert.equal(findReplaceDetailed('x'.repeat(10_000), 'x').count, 10_000);
    assert.throws(() => findReplace('x'.repeat(10_001), 'x'), /10,000 literal matches/);
    assert.equal(findReplaceDetailed('x'.repeat(1_000), 'x', '', { regex: true }).count, 1_000);
    assert.throws(() => findReplace('x'.repeat(1_001), 'x', '', { regex: true }), /1,000 matches/);
    assert.equal(findReplace('x'.repeat(250), 'x', 'a'.repeat(4_000)).length, 1_000_000);
    assert.throws(() => findReplace('x'.repeat(251), 'x', 'a'.repeat(4_000)), /1,000,000/);
    assert.throws(() => findReplace('x'.repeat(100_001), 'x'), /100,000/);
    assert.throws(() => findReplace('a', 'x'.repeat(4_001)), /4,000/);
    assert.throws(() => findReplace('a', 'x', 'y'.repeat(4_001)), /4,000/);
  });

  it('rejects malformed regex, extra flags and Unicode at every field boundary', () => {
    assert.throws(() => findReplace('x', ''), /required/);
    assert.throws(() => findReplace('x', '(', '', { regex: true }), /Invalid/);
    for (const flags of ['g', 'i', 'uu', 'uv', 'z'])
      assert.throws(() => findReplace('x', 'x', '', { flags, regex: true }), /Extra flags/);
    for (const source of ['\0', '\uD800'])
      assert.throws(() => findReplace(source, 'x'), /Unicode|NUL/);
    assert.throws(() => findReplace('\uD800', '\uDC00'), /Unicode/);
    assert.throws(() => findReplace('x', '\uD800', '\uDC00'), /Unicode/);
    assert.throws(() => findReplace('x', 'x', '\0'), /NUL/);
  });
});
