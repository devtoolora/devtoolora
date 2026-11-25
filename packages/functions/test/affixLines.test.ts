import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { affixLines, affixLinesDetailed } from '@devtoolora/functions/text';

describe('literal physical-line affixes', () => {
  it('retains mixed terminators without affixing an imaginary terminal row', () => {
    assert.equal(affixLines('one\r\ntwo\rthree\n', '- ', ';'), '- one;\r\n- two;\r- three;\n');
    assert.equal(affixLines('one\n', '- '), '- one\n');
    assert.equal(affixLines('one', '- '), '- one');
    assert.equal(affixLines('', '[', ']'), '');
    const result = affixLinesDetailed('one\ntwo', { prefix: '[', suffix: ']' });

    assert.equal(result.changedLines, 2);
    assert.equal(result.prefixChanges, 2);
    assert.equal(result.suffixChanges, 2);
    assert.equal(result.inputLines, 2);
    assert.equal(result.outputLines, 2);
  });

  it('preserves indentation and makes blank eligibility explicit', () => {
    assert.equal(
      affixLinesDetailed('  first();\n\tsecond();\n\n', {
        placement: 'after-indent',
        prefix: '// ',
      }).text,
      '  // first();\n\t// second();\n\n',
    );

    const skipped = affixLinesDetailed('a\n\n \n\t\nb', { prefix: '> ' });

    assert.equal(skipped.text, '> a\n\n \n\t\n> b');
    assert.equal(skipped.skippedBlankLines, 3);

    assert.equal(
      affixLinesDetailed('\n \n', { blankLines: 'include', prefix: '> ' }).text,
      '> \n>  \n',
    );

    assert.equal(affixLines('\n', '> '), '> \n');
    assert.equal(affixLinesDetailed('\u00A0\n\u200B', { prefix: 'x' }).text, 'x\u00A0\nx\u200B');
  });

  it('adds only missing sides independently without interpreting syntax', () => {
    const options = { prefix: '[', repeat: 'if-missing', suffix: ']' } as const;
    const result = affixLinesDetailed('[one]\ntwo]\n[three\nfour', options);

    assert.equal(result.text, '[one]\n[two]\n[three]\n[four]');
    assert.equal(result.prefixChanges, 2);
    assert.equal(result.suffixChanges, 2);
    assert.equal(result.changedLines, 3);
    assert.equal(affixLinesDetailed(result.text, options).text, result.text);
    assert.equal(affixLines('a', '$&', '\\n'), '$&a\\n');

    assert.equal(
      affixLinesDetailed('', {
        blankLines: 'include',
        prefix: '[',
        repeat: 'if-missing',
        suffix: ']',
      }).text,
      '',
    );

    assert.equal(
      affixLinesDetailed('\n', {
        blankLines: 'include',
        prefix: '[',
        repeat: 'if-missing',
        suffix: '[',
      }).text,
      '[[\n',
    );
  });

  it('removes at most one exact boundary occurrence and preserves unmatched text', () => {
    const result = affixLinesDetailed('[alpha]\nbeta]\n[gamma\nplain', {
      mode: 'remove',
      prefix: '[',
      suffix: ']',
    });

    assert.equal(result.text, 'alpha\nbeta\ngamma\nplain');
    assert.equal(result.prefixChanges, 2);
    assert.equal(result.suffixChanges, 2);
    assert.equal(result.changedLines, 3);

    assert.equal(
      affixLinesDetailed('[[one]]', { mode: 'remove', prefix: '[', suffix: ']' }).text,
      '[one]',
    );

    assert.equal(
      affixLinesDetailed('  // one  ', {
        mode: 'remove',
        placement: 'after-indent',
        prefix: '// ',
        suffix: '  ',
      }).text,
      '  one',
    );

    assert.equal(affixLinesDetailed('xx', { mode: 'remove', prefix: 'xx', suffix: 'xx' }).text, '');
    assert.equal(affixLinesDetailed('Prefix', { mode: 'remove', prefix: 'prefix' }).text, 'Prefix');

    assert.equal(
      affixLinesDetailed('cafe\u0301', { mode: 'remove', prefix: 'café' }).text,
      'cafe\u0301',
    );
  });

  it('reports empty-result and CR/LF boundary changes without dropping bytes', () => {
    const empty = affixLinesDetailed('[]', { mode: 'remove', prefix: '[', suffix: ']' });

    assert.equal(empty.text, '');
    assert.equal(empty.inputLines, 1);
    assert.equal(empty.outputLines, 0);
    assert.equal(empty.lineStructureChanged, true);
    const joined = affixLinesDetailed('x\rx\n', { mode: 'remove', prefix: 'x' });

    assert.equal(joined.text, '\r\n');
    assert.equal(joined.inputLines, 2);
    assert.equal(joined.outputLines, 1);
    assert.equal(joined.lineStructureChanged, true);
    assert.equal(affixLinesDetailed('unchanged\r\n').changedLines, 0);
  });

  it('validates Unicode, single-line affixes and input/output budgets', () => {
    assert.equal(affixLines('x'.repeat(100_000)).length, 100_000);
    assert.equal(affixLinesDetailed('x\n'.repeat(10_000)).inputLines, 10_000);
    assert.equal(affixLines('a', 'x'.repeat(1_000)).length, 1_001);
    assert.throws(() => affixLines('x'.repeat(100_001)), /100,000/);
    assert.throws(() => affixLines('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => affixLines('x\n'.repeat(1_000), 'p'.repeat(1_000)), /1,000,000/);
    for (const prefix of ['x'.repeat(1_001), '\r', '\n', '\0', '\uD800'])
      assert.throws(() => affixLines('a', prefix), /Prefix/);
    assert.throws(() => affixLines('a', '', '\r\n'), /Suffix/);
    assert.throws(() => affixLines('\uD800'), /Unicode/);
    assert.throws(() => affixLines('\0'), /NUL/);
  });
});
