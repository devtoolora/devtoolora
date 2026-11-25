import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { inspectUnicode } from '@devtoolora/functions/encoding';

describe('inspectUnicode', () => {
  it('describes code points', () => {
    const result = inspectUnicode('\u00E9\u{1F600}');

    assert.deepEqual(
      result.rows.map((r) => [r.codePoint, r.utf8, r.utf16, r.category]),
      [
        ['U+00E9', 'C3 A9', '00E9', 'Ll Lowercase Letter'],
        ['U+1F600', 'F0 9F 98 80', 'D83D DE00', 'So Other Symbol'],
      ],
    );

    assert.equal(result.bytes, 6);
  });

  it('groups combining marks into graphemes', () => {
    const result = inspectUnicode('e\u0301x');

    assert.equal(result.graphemes, 2);

    assert.deepEqual(
      result.rows.map((r) => r.grapheme),
      [1, 1, 2],
    );
  });

  it('shows control pictures', () => {
    const [row] = inspectUnicode('\n').rows;

    assert.equal(row?.char, '\u240A');
    assert.equal(row?.category, 'Cc Control');
  });

  it('handles lone surrogates', () => {
    const result = inspectUnicode('a\uD800');

    assert.equal(result.rows[1]?.category, 'Cs Surrogate');
    assert.equal(result.rows[1]?.utf8, 'invalid (lone surrogate)');
    assert.equal(result.rows[1]?.char, '');
    assert.equal(result.bytes, 1);
  });

  it('limits input to 10,000 code points', () => {
    assert.equal(inspectUnicode('x'.repeat(10_000)).rows.length, 10_000);
    assert.throws(() => inspectUnicode('x'.repeat(10_001)), /10,000 code points/);
    assert.throws(() => inspectUnicode('\u{1F600}'.repeat(10_001)), /10,000 code points/);
  });
});
