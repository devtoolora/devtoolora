import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { testRegex } from '@devtoolora/functions/text';

describe('honest JavaScript regex testing', () => {
  it('honors global, first-only and sticky flags without adding or discarding flags', () => {
    assert.equal(testRegex('12 34', '\\d+', '').count, 1);
    assert.equal(testRegex('12 34', '\\d+', 'g').count, 2);
    assert.equal(testRegex('12 34', '\\d+', 'gy').count, 1);
    assert.equal(testRegex('x12', '\\d+', 'y').count, 0);
    for (const flags of ['gg', 'G', 'g ', 'uv', 'x'])
      assert.throws(() => testRegex('text', '.', flags), /Flags/);
    assert.throws(() => testRegex('text', '('), /Invalid or unsupported/);
  });

  it('preserves empty and unmatched captures, Unicode zero-width positions and d indices', () => {
    const report = testRegex('b ab', '(?<first>a)?(b)', 'dg');

    assert.deepEqual(report.matches[0]!.captures, [null, 'b']);
    assert.deepEqual(report.matches[0]!.groups, { first: null });
    assert.deepEqual(report.matches[0]!.indices, [[0, 1], null, [0, 1]]);
    assert.equal(testRegex('b', '()(b)').matches[0]!.captures[0], '');

    assert.deepEqual(
      testRegex('😀😀', '(?=😀)|$', 'gu').matches.map((match) => match.index),
      [0, 2, 4],
    );

    assert.equal(testRegex('', '', 'g').count, 1);
    assert.equal(testRegex('a b', ' ', 'g').matches[0]!.index, 1);
  });

  it('matches native replacement substitution including empty, prefix/suffix and absent captures', () => {
    const cases = [
      { flags: 'g', pattern: '(?<first>a)?(b)', source: 'b ab' },
      { flags: '', pattern: '(a)(b)', source: 'before ab after ab' },
      { flags: 'gu', pattern: '(?=😀)|$', source: '😀😀' },
      { flags: 'g', pattern: '', source: 'ab' },
    ];

    for (const entry of cases) {
      for (const replacement of [
        '',
        '$$',
        '$&',
        '$1/$2/$10/$01/$00/$99',
        '$<first>/$<missing>/$<toString>',
        "$`|$'",
      ]) {
        assert.equal(
          testRegex(entry.source, entry.pattern, entry.flags, replacement).replacementPreview,
          entry.source.replace(new RegExp(entry.pattern, entry.flags), replacement),
        );
      }
    }

    assert.equal(testRegex('x', '.', 'g', '').replacementPreview, '');
    assert.equal(testRegex('x', '.', 'g').replacementPreview, undefined);
  });

  it('bounds matches, report size and replacement expansion rather than returning partial data', () => {
    assert.throws(() => testRegex('a'.repeat(1001), '.', 'g'), /1,000 matches/);
    assert.throws(() => testRegex('x'.repeat(100_001), 'x'), /100,000/);
    assert.throws(() => testRegex('x', 'a'.repeat(4001)), /4,000/);
    assert.throws(() => testRegex('x', '.', 'g', 'a'.repeat(4001)), /4,000/);
    assert.throws(() => testRegex('a'.repeat(1000), '.', 'g', 'x'.repeat(2000)), /1,000,000/);
    assert.throws(() => testRegex('\ud800', '.'), /unpaired/);
  });
});
