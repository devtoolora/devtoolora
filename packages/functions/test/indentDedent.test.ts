import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { adjustIndentation } from '@devtoolora/functions/text';

describe('strict literal-character indentation', () => {
  it('adds spaces or tabs to actual eligible rows without altering body text or terminators', () => {
    const result = adjustIndentation('one\r\ntwo\rthree\n');

    assert.equal(result.text, '  one\r\n  two\r  three\n');
    assert.equal(result.changedLines, 3);
    assert.equal(result.spacesAdded, 6);
    assert.equal(result.tabsAdded, 0);
    assert.equal(result.inputLines, 3);
    assert.equal(result.outputLines, 3);
    assert.equal(adjustIndentation('one\ntwo', { amount: 1, unit: 'tabs' }).text, '\tone\n\ttwo');
    assert.equal(adjustIndentation('one\n').text, '  one\n');
    assert.equal(adjustIndentation('').text, '');
    assert.equal(adjustIndentation('  one\n\ttwo', { amount: 0 }).text, '  one\n\ttwo');
  });

  it('separates up-to and exact removal without substituting tabs for spaces', () => {
    const source = ' one\n  two\n\tthree\n';

    assert.equal(adjustIndentation(source, { mode: 'dedent' }).text, 'one\ntwo\n\tthree\n');

    assert.equal(
      adjustIndentation(source, { mode: 'dedent', partial: 'exact' }).text,
      ' one\ntwo\n\tthree\n',
    );

    assert.equal(
      adjustIndentation('\tone\n  two\n\t\tthree', { amount: 1, mode: 'dedent', unit: 'tabs' })
        .text,
      'one\n  two\n\tthree',
    );

    assert.equal(adjustIndentation(' \tword', { mode: 'dedent' }).text, '\tword');

    assert.equal(
      adjustIndentation('\t \tword', { amount: 2, mode: 'dedent', unit: 'tabs' }).text,
      ' \tword',
    );

    assert.equal(
      adjustIndentation('\t \tword', { amount: 2, mode: 'dedent', partial: 'exact', unit: 'tabs' })
        .text,
      '\t \tword',
    );
  });

  it('computes a literal shared prefix from nonblank lines and preserves relative nesting', () => {
    const result = adjustIndentation('\t one\n\t  two\n\n', { mode: 'common' });

    assert.equal(result.commonPrefix, '\t ');
    assert.equal(result.text, 'one\n two\n\n');
    assert.equal(result.tabsRemoved, 2);
    assert.equal(result.spacesRemoved, 2);
    assert.equal(result.skippedBlankLines, 1);
    assert.equal(adjustIndentation('\t one\n  two', { mode: 'common' }).commonPrefix, '');
    assert.equal(adjustIndentation('  one\ntwo', { mode: 'common' }).text, '  one\ntwo');

    assert.equal(
      adjustIndentation(' \t\n\n', { blankLines: 'include', mode: 'common' }).text,
      ' \t\n\n',
    );

    assert.equal(
      adjustIndentation('  one\n    two\n \n  \n', { blankLines: 'include', mode: 'common' }).text,
      'one\n  two\n \n\n',
    );
  });

  it('makes blank processing explicit and reports physical representation changes', () => {
    assert.equal(adjustIndentation('a\n\n \n\t\nb').text, '  a\n\n \n\t\n  b');
    assert.equal(adjustIndentation('a\n\n', { blankLines: 'include' }).text, '  a\n  \n');
    assert.equal(adjustIndentation('\u00A0a\n\u200Ba').text, '  \u00A0a\n  \u200Ba');
    assert.equal(adjustIndentation('\u00A0a', { mode: 'dedent' }).text, '\u00A0a');
    const empty = adjustIndentation('  ', { blankLines: 'include', mode: 'dedent' });

    assert.equal(empty.text, '');
    assert.equal(empty.lineStructureChanged, true);
    assert.equal(empty.outputLines, 0);
    const merged = adjustIndentation(' \r \n', { blankLines: 'include', mode: 'dedent' });

    assert.equal(merged.text, '\r\n');
    assert.equal(merged.inputLines, 2);
    assert.equal(merged.outputLines, 1);
    assert.equal(merged.lineStructureChanged, true);
  });

  it('round-trips fixed indentation', () => {
    const source = '😀\r\n  body  \r\ttail\n\n';

    for (const unit of ['spaces', 'tabs'] as const) {
      for (const amount of [0, 1, 2, 64]) {
        const added = adjustIndentation(source, { amount, blankLines: 'include', unit }).text;

        assert.equal(
          adjustIndentation(added, {
            amount,
            blankLines: 'include',
            mode: 'dedent',
            partial: 'exact',
            unit,
          }).text,
          source,
        );
      }
    }
  });

  it('validates active settings, Unicode and budgets while accepting zero and hidden drafts', () => {
    assert.equal(adjustIndentation('x'.repeat(100_000), { amount: 64 }).text.length, 100_064);
    assert.equal(adjustIndentation('x\n'.repeat(10_000)).inputLines, 10_000);
    for (const amount of [-1, 1.5, NaN, 65])
      assert.throws(() => adjustIndentation('x', { amount }), /0 through 64/);
    assert.throws(() => adjustIndentation('x'.repeat(100_001)), /100,000/);
    assert.throws(() => adjustIndentation('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => adjustIndentation('\uD800'), /Unicode/);
    assert.throws(() => adjustIndentation('\0'), /NUL/);
    assert.equal(adjustIndentation('  one', { amount: NaN, mode: 'common' }).text, 'one');
  });
});
