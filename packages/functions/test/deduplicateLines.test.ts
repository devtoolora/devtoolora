import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { deduplicateLines, deduplicateLinesDetailed } from '@devtoolora/functions/text';

describe('explicit global line deduplication', () => {
  it('retains first or last representatives in their original source order', () => {
    assert.equal(deduplicateLines('Alpha\nbeta\nalpha'), 'Alpha\nbeta\n');

    assert.equal(
      deduplicateLinesDetailed('Alpha\nbeta\nalpha', { keep: 'last' }).text,
      'beta\nalpha',
    );

    assert.equal(deduplicateLines('ID\nid\nID', true), 'ID\nid\n');
    const result = deduplicateLinesDetailed('x\ny\nx\nz\ny');

    assert.equal(result.inputLines, 5);
    assert.equal(result.retainedLines, 3);
    assert.equal(result.removedDuplicates, 2);
    assert.equal(result.outputLines, 3);
  });

  it('changes comparison keys only and makes NFC normalization opt-in', () => {
    assert.equal(
      deduplicateLinesDetailed('  beta  \nbeta\nalpha', { trimComparison: true }).text,
      '  beta  \nalpha',
    );

    assert.equal(deduplicateLines('cafe\u0301\ncafé\ncafe'), 'cafe\u0301\ncafé\ncafe');

    assert.equal(
      deduplicateLinesDetailed('cafe\u0301\ncafé\ncafe', { normalizeComparison: true }).text,
      'cafe\u0301\ncafe',
    );

    assert.equal(
      deduplicateLinesDetailed('ß\nSS\nﬀ\nff', { normalizeComparison: true }).text,
      'ß\nSS\nﬀ\nff',
    );

    assert.equal(deduplicateLines('\u00A0x\nx'), '\u00A0x\nx');

    assert.equal(
      deduplicateLinesDetailed('\u00A0x\nx', { trimComparison: true }).text,
      '\u00A0x\nx',
    );
  });

  it('handles blank records explicitly and does not count a terminal sentinel', () => {
    assert.equal(deduplicateLines('\n\n'), '\n');

    assert.equal(
      deduplicateLinesDetailed('a\n\na\n\nb\n', { blankLines: 'keep' }).text,
      'a\n\n\nb\n',
    );

    const result = deduplicateLinesDetailed(' \t\r\n\r\na\na', { blankLines: 'remove' });

    assert.equal(result.text, 'a\n');
    assert.equal(result.removedBlankLines, 2);
    assert.equal(result.removedDuplicates, 1);
    assert.equal(deduplicateLines('\n \n\t\n'), '\n \n\t\n');
    assert.equal(deduplicateLinesDetailed('\n \n\t\n', { trimComparison: true }).text, '\n');

    assert.equal(
      deduplicateLinesDetailed('\u00A0\n\u200B', { blankLines: 'remove' }).text,
      '\u00A0\n\u200B',
    );

    assert.equal(deduplicateLinesDetailed('').inputLines, 0);
  });

  it('preserves retained terminators and reports merged CR/LF boundaries', () => {
    assert.equal(deduplicateLines('Alpha\r\nbeta\ralpha\n'), 'Alpha\r\nbeta\r');

    assert.equal(
      deduplicateLinesDetailed('Alpha\r\nbeta\ralpha\n', { keep: 'last' }).text,
      'beta\ralpha\n',
    );

    const result = deduplicateLinesDetailed('x\rx\n\n');

    assert.equal(result.text, 'x\r\n');
    assert.equal(result.retainedLines, 2);
    assert.equal(result.outputLines, 1);
    assert.equal(result.lineStructureChanged, true);
    assert.equal(deduplicateLines('one\n'), 'one\n');
  });

  it('is idempotent with uniform endings across all comparison and blank policies', () => {
    const text = 'Alpha\n\nalpha\n  beta  \nbeta\ncafe\u0301\ncafé\n\n';

    for (const keep of ['first', 'last'] as const) {
      for (const blankLines of ['deduplicate', 'keep', 'remove'] as const) {
        for (const caseSensitive of [true, false]) {
          const options = {
            blankLines,
            caseSensitive,
            keep,
            normalizeComparison: true,
            trimComparison: true,
          };
          const result = deduplicateLinesDetailed(text, options);

          assert.equal(
            result.inputLines,
            result.retainedLines + result.removedDuplicates + result.removedBlankLines,
          );

          assert.equal(deduplicateLinesDetailed(result.text, options).text, result.text);
        }
      }
    }
  });

  it('rejects invalid Unicode, options and oversized inputs', () => {
    assert.equal(deduplicateLines('x'.repeat(100_000)).length, 100_000);
    assert.equal(deduplicateLinesDetailed('x\n'.repeat(10_000)).inputLines, 10_000);
    assert.throws(() => deduplicateLines('x'.repeat(100_001)), /100,000/);
    assert.throws(() => deduplicateLines('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => deduplicateLines('x\0'), /NUL/);
    assert.throws(() => deduplicateLines('\uD800'), /unpaired/);
  });
});
