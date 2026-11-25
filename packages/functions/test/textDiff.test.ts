import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  compareTextLines,
  diffLines,
  formatTextDiff,
  type TextDiffResult,
} from '@devtoolora/functions/text';

function reconstruct(result: TextDiffResult, side: 'after' | 'before'): string {
  const endings = { CR: '\r', CRLF: '\r\n', LF: '\n', none: '' };

  return result.rows
    .map((row) => row[side])
    .filter((line) => line !== undefined)
    .map((line) => line.text + endings[line.ending])
    .join('');
}

describe('aligned text diff', () => {
  it('aligns insertions and removals without treating shifted lines as replacements', () => {
    const result = compareTextLines('one\nthree\n', 'one\ntwo\nthree\n');

    assert.equal(result.added, 1);
    assert.equal(result.removed, 0);
    assert.equal(result.unchanged, 2);

    assert.deepEqual(
      result.rows.map((row) => [row.kind, row.before?.number, row.after?.number]),
      [
        ['unchanged', 1, 1],
        ['added', undefined, 2],
        ['unchanged', 2, 3],
      ],
    );

    assert.equal(compareTextLines('one\ntwo\nthree\n', 'one\nthree\n').removed, 1);
    assert.equal(diffLines('one\nthree\n', 'one\ntwo\nthree\n'), '  one\n+ two\n  three');
  });

  it('preserves physical lines, CRLF/CR/LF and final terminators with zero lines for empty text', () => {
    const result = compareTextLines('a\r\nb\rc\nlast', 'a\nb\rc\nlast\n');

    assert.equal(result.beforeLines, 4);
    assert.equal(result.added, 2);
    assert.equal(result.removed, 2);
    assert.equal(reconstruct(result, 'before'), 'a\r\nb\rc\nlast');
    assert.equal(reconstruct(result, 'after'), 'a\nb\rc\nlast\n');
    assert.equal(compareTextLines('', '').rows.length, 0);
    assert.equal(compareTextLines('', '\n').afterLines, 1);
    assert.equal(compareTextLines('\n\n', '').beforeLines, 2);
    assert.equal(compareTextLines('a\u2028b', '').beforeLines, 1);
  });

  it('labels normalized equivalence honestly without modifying either original', () => {
    const before = '  Hello\t  world \r\n';
    const after = 'hello world\n';
    const result = compareTextLines(before, after, {
      ignoreCase: true,
      ignoreLineEndings: true,
      ignoreWhitespace: true,
    });

    assert.equal(result.added, 0);
    assert.equal(result.removed, 0);
    assert.equal(result.equivalent, 1);
    assert.equal(reconstruct(result, 'before'), before);
    assert.equal(reconstruct(result, 'after'), after);
    assert.equal(compareTextLines('é', 'e', { ignoreCase: true }).unchanged, 0);
    const caseMapped = compareTextLines('Straße\nστάσις\nẞ\n', 'STRASSE\nΣΤΆΣΙΣ\nss\n', {
      ignoreCase: true,
    });

    assert.deepEqual([caseMapped.added, caseMapped.removed, caseMapped.equivalent], [0, 0, 3]);
    assert.equal(compareTextLines('Straße', 'STRASSE').unchanged, 0);
    assert.equal(compareTextLines('a\n', 'a', { ignoreLineEndings: true }).equivalent, 1);
    assert.match(formatTextDiff(result), /"  Hello\\t  world " \[CRLF\]/);
  });

  it('highlights changed middles without splitting Unicode code points or inventing character changes for EOL-only edits', () => {
    const result = compareTextLines('before 😀 end\n', 'before 😃 end\n');
    const row = result.rows[0]!;

    assert.deepEqual(row.before?.highlight, { end: 9, start: 7 });

    assert.equal(
      row.before?.text.slice(row.before.highlight?.start, row.before.highlight?.end),
      '😀',
    );

    assert.equal(row.after?.text.slice(row.after.highlight?.start, row.after.highlight?.end), '😃');

    assert.deepEqual(compareTextLines('same\n', 'same').rows[0]!.before?.highlight, {
      end: 4,
      start: 4,
    });
  });

  it('finds minimal edit counts on deterministic repeated-line cases and reconstructs both sources', () => {
    let seed = 7;

    function sequence(): string[] {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const size = seed % 9;

      return Array.from({ length: size }, () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;

        return `line-${seed % 4}`;
      });
    }

    for (let iteration = 0; iteration < 300; iteration += 1) {
      const left = sequence();
      const right = sequence();
      const table = Array.from(
        { length: left.length + 1 },
        () => new Uint16Array(right.length + 1),
      );

      for (let x = 1; x <= left.length; x += 1)
        for (let y = 1; y <= right.length; y += 1)
          table[x]![y] =
            left[x - 1] === right[y - 1]
              ? table[x - 1]![y - 1]! + 1
              : Math.max(table[x - 1]![y]!, table[x]![y - 1]!);
      const before = left.length ? left.join('\n') + '\n' : '';
      const after = right.length ? right.join('\n') + '\n' : '';
      const result = compareTextLines(before, after);

      assert.equal(
        result.added + result.removed,
        left.length + right.length - 2 * table[left.length]![right.length]!,
      );

      assert.equal(reconstruct(result, 'before'), before);
      assert.equal(reconstruct(result, 'after'), after);
    }
  });

  it('handles large simple differences and rejects oversized or expensive ambiguous inputs instead of guessing', () => {
    assert.equal(compareTextLines('a'.repeat(100_000), '').removed, 1);
    assert.equal(compareTextLines('a\n'.repeat(10_000), 'b\n'.repeat(10_000)).added, 10_000);
    assert.throws(() => compareTextLines('a'.repeat(100_001), ''), /100,000/);
    assert.throws(() => compareTextLines('\n'.repeat(10_001), ''), /10,000 physical lines/);
    assert.throws(() => compareTextLines('\ud800', ''), /valid Unicode/);
    assert.throws(() => compareTextLines('\0', ''), /NUL/);
    const left = Array.from({ length: 1100 }, (_, index) => `before-${index}`);
    const right = Array.from({ length: 1100 }, (_, index) => `after-${index}`);

    left.splice(550, 0, 'shared');
    right.splice(550, 0, 'shared');

    assert.throws(
      () => compareTextLines(left.join('\n'), right.join('\n')),
      /1,024 insertions\/deletions/,
    );
  });
});
