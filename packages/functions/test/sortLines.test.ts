import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sortLines, sortLinesDetailed } from '@devtoolora/functions/text';

describe('stable explicit line sorting', () => {
  it('sorts natural digit groups without changing their original spelling', () => {
    assert.equal(sortLines('item10\nitem2\nitem1'), 'item1\nitem2\nitem10');
    assert.equal(sortLines('item10\nitem2\nitem1', { numeric: false }), 'item1\nitem10\nitem2');

    assert.equal(
      sortLines('item2\nitem02\nitem002', { direction: 'desc' }),
      'item2\nitem02\nitem002',
    );

    assert.equal(sortLines('b\n10\n2\na'), '2\n10\na\nb');
  });

  it('keeps equal-key order stable in both directions and uses the selected locale', () => {
    const source = 'résumé\nresume\nRESUME';

    assert.equal(sortLines(source, { accentSensitive: false }), source);
    assert.equal(sortLines(source, { accentSensitive: false, direction: 'desc' }), source);

    assert.equal(
      sortLines('chata\nžába\nčaj\nhad\ncena', { locale: 'cs' }),
      'cena\nčaj\nhad\nchata\nžába',
    );

    assert.equal(sortLines('ä\nz\na', { locale: 'sv' }), 'a\nz\nä');
    assert.equal(sortLines('ä\nz\na', { locale: 'de' }), 'a\nä\nz');
    assert.equal(sortLinesDetailed('b\na', { locale: 'cs' }).locale, 'cs');
  });

  it('maps case and accent sensitivity onto the collator strength', () => {
    const source = 'RESUME\nrésumé\nresume';

    assert.equal(sortLines(source, { caseSensitive: true }), 'resume\nRESUME\nrésumé');

    assert.equal(
      sortLines(source, { accentSensitive: false, caseSensitive: true }),
      'résumé\nresume\nRESUME',
    );

    assert.equal(sortLines(source, { accentSensitive: false }), source);
    assert.equal(sortLines(source), 'RESUME\nresume\nrésumé');
  });

  it('preserves raw padding and separator-slot terminators while comparing trimmed keys', () => {
    assert.equal(
      sortLines('  beta  \r\nalpha\r\tgamma\t\n', { trimComparison: true }),
      'alpha\r\n  beta  \r\tgamma\t\n',
    );

    assert.equal(sortLines('zebra\r\nalpha\rbeta\n'), 'alpha\r\nbeta\rzebra\n');
    assert.equal(sortLines('b\na'), 'a\nb');
    assert.equal(sortLines('b\na\n'), 'a\nb\n');
    assert.equal(sortLines('one\n'), 'one\n');
    assert.equal(sortLines(''), '');
  });

  it('handles blank policies explicitly without deduplicating content', () => {
    const source = 'b\n\na\n';

    assert.equal(sortLines(source), 'a\n\nb\n');
    assert.equal(sortLines(source, { blankLines: 'first', direction: 'desc' }), '\nb\na\n');
    assert.equal(sortLines(source, { blankLines: 'last' }), 'a\nb\n\n');
    assert.equal(sortLines(source, { blankLines: 'sort' }), '\na\nb\n');
    const removed = sortLinesDetailed(' \t\r\nb\r\n\ra', { blankLines: 'remove' });

    assert.equal(removed.text, 'a\r\nb');
    assert.equal(removed.removedBlankLines, 2);
    assert.equal(sortLines('a\na\nb'), 'a\na\nb');
    assert.equal(sortLines(' \t\r\n\r\n', { blankLines: 'remove' }), '');
    assert.equal(sortLines('\u00A0\n', { blankLines: 'remove' }), '\u00A0\n');
  });

  it('compares actual Unicode code points and ignores inactive locale options', () => {
    assert.equal(
      sortLines('😀\n\uE000\nA\na', { locale: 'invalid_tag', ordering: 'code-points' }),
      'A\na\n\uE000\n😀',
    );

    assert.equal(sortLines('x2\nx10', { ordering: 'code-points' }), 'x10\nx2');
    assert.equal(sortLines('a\nA', { ordering: 'code-points' }), 'A\na');
  });

  it('reports physical line changes caused by empty-body placement without rewriting separators', () => {
    const joined = sortLinesDetailed('z\rx\n\n\nb\n', { blankLines: 'first' });

    assert.equal(joined.text, '\r\nb\nx\nz\n');
    assert.equal(joined.inputLines, 5);
    assert.equal(joined.outputLines, 4);
    assert.equal(joined.lineStructureChanged, true);
    const terminal = sortLinesDetailed('\na', { blankLines: 'last' });

    assert.equal(terminal.text, 'a\n');
    assert.equal(terminal.outputLines, 1);
    assert.equal(terminal.lineStructureChanged, true);

    assert.equal(
      sortLinesDetailed('b\n\na\n', { blankLines: 'remove' }).lineStructureChanged,
      false,
    );
  });

  it('retains the exact line-body multiset and is idempotent across policies and directions', () => {
    const bodies = ['item10', '  beta  ', 'Résumé', 'resume', '', '\t', 'item02', 'item2', '😀'];
    const endings = ['\r\n', '\r', '\n'];
    const source = bodies.map((body, index) => body + endings[index % endings.length]).join('');
    const policies: Array<'keep' | 'sort' | 'first' | 'last' | 'remove'> = [
      'keep',
      'sort',
      'first',
      'last',
      'remove',
    ];

    for (const blankLines of policies) {
      for (const direction of ['asc', 'desc'] as const) {
        for (const ordering of ['locale', 'code-points'] as const) {
          const options = { blankLines, direction, ordering, trimComparison: true };
          const sorted = sortLines(source, options);
          const expected =
            blankLines === 'remove' ? bodies.filter((body) => !/^[ \t]*$/.test(body)) : bodies;

          assert.deepEqual(
            sorted
              .split(/\r\n|\r|\n/)
              .slice(0, -1)
              .sort(),
            expected.slice().sort(),
          );

          assert.equal(sortLines(sorted, options), sorted);
        }
      }
    }
  });

  it('validates supported locales, Unicode and bounds without silent fallbacks', () => {
    assert.equal(sortLines('x'.repeat(100_000)).length, 100_000);
    assert.equal(sortLinesDetailed('x\n'.repeat(10_000)).inputLines, 10_000);
    for (const locale of ['', 'en_US', 'qaa', 'not a locale'])
      assert.throws(() => sortLines('b\na', { locale }), /valid, supported/);
    assert.throws(() => sortLines('x'.repeat(100_001)), /100,000/);
    assert.throws(() => sortLines('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => sortLines('x\0'), /NUL/);
    assert.throws(() => sortLines('\uD800'), /unpaired/);
  });
});
