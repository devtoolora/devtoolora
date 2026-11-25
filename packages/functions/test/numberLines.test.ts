import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { numberLines, numberLinesDetailed } from '@devtoolora/functions/text';

describe('exact physical-line numbering', () => {
  it('preserves original bodies and mixed terminators without a phantom final row', () => {
    assert.equal(numberLines('one\r\ntwo\rthree\n'), '1. one\r\n2. two\r3. three\n');
    assert.equal(numberLines('one\n'), '1. one\n');
    assert.equal(numberLines('one'), '1. one');
    assert.equal(numberLines(''), '');
    assert.equal(numberLines('one\ntwo', 7, 2), '07. one\n08. two');
    assert.equal(numberLines('a', 1, 1, '$&\\n'), '1$&\\na');
  });

  it('handles negative, descending and deliberately constant labels with sign-aware padding', () => {
    assert.equal(
      numberLinesDetailed('a\nb\nc', { start: -2, step: 2, width: 3 }).text,
      '-002. a\n000. b\n002. c',
    );

    assert.equal(numberLinesDetailed('a\nb\nc', { start: 3, step: -1 }).text, '3. a\n2. b\n1. c');
    assert.equal(numberLinesDetailed('a\nb', { start: 10, step: 0 }).text, '10. a\n10. b');
    assert.equal(numberLines('a', 1234, 2, ''), '1234a');
    assert.equal(numberLines('a', -0, 3), '000. a');
  });

  it('skips blank bodies without consuming numbers and preserves indentation', () => {
    const result = numberLinesDetailed('one\n\n \n\t\ntwo\n', {
      blankLines: 'skip',
      start: 7,
      step: 2,
    });

    assert.equal(result.text, '7. one\n\n \n\t\n9. two\n');
    assert.equal(result.inputLines, 5);
    assert.equal(result.numberedLines, 2);
    assert.equal(result.skippedBlankLines, 3);
    assert.equal(result.firstNumber, 7);
    assert.equal(result.lastNumber, 9);
    assert.equal(numberLines('\n'), '1. \n');

    assert.equal(
      numberLinesDetailed('  alpha\n\tbeta  \n', { placement: 'after-indent', separator: ': ' })
        .text,
      '  1: alpha\n\t2: beta  \n',
    );

    assert.equal(
      numberLinesDetailed('\u00A0\n\u200B', { blankLines: 'skip' }).text,
      '1. \u00A0\n2. \u200B',
    );

    const blanks = numberLinesDetailed(' \t\r\n\r', { blankLines: 'skip' });

    assert.equal(blanks.text, ' \t\r\n\r');
    assert.equal(blanks.firstNumber, undefined);
    assert.equal(blanks.lastNumber, undefined);
    assert.equal(blanks.numberedLines, 0);
  });

  it('uses exact sequence arithmetic and rejects only actual out-of-range labels', () => {
    const maximum = Number.MAX_SAFE_INTEGER;

    assert.equal(numberLines('a', maximum), '9007199254740991. a');

    assert.equal(
      numberLinesDetailed('a\nb', { start: -maximum, step: maximum }).text,
      '-9007199254740991. a\n0. b',
    );

    assert.equal(
      numberLinesDetailed('a\nb\nc', { start: -maximum, step: maximum }).lastNumber,
      maximum,
    );

    assert.throws(() => numberLines('a\nb', maximum), /physical line 2/);

    assert.throws(
      () => numberLinesDetailed('a\nb', { start: -maximum, step: -1 }),
      /safe integer range/,
    );

    assert.equal(
      numberLinesDetailed('a\n\n', { blankLines: 'skip', start: maximum }).numberedLines,
      1,
    );
  });

  it('retains the original body suffix for every numbered physical row', () => {
    const bodies = ['😀', '  alpha  ', '\tbeta', '', ' \t'];
    const text = bodies.map((body) => body + '\n').join('');

    for (const placement of ['line-start', 'after-indent'] as const) {
      for (const blankLines of ['number', 'skip'] as const) {
        const result = numberLinesDetailed(text, {
          blankLines,
          placement,
          separator: '|',
          start: -5,
          step: 3,
          width: 4,
        });

        assert.equal(result.inputLines, result.numberedLines + result.skippedBlankLines);
        const numbered = result.text.split('\n').slice(0, -1);

        assert.equal(numbered.length, bodies.length);
        let count = 0;

        bodies.forEach((body, index) => {
          if (blankLines === 'skip' && /^[ \t]*$/.test(body)) assert.equal(numbered[index], body);
          else {
            const indent = placement === 'after-indent' ? (body.match(/^[ \t]*/)?.[0] ?? '') : '';
            const label = -5 + 3 * count++;

            assert.equal(
              numbered[index],
              indent +
                (label < 0 ? '-' : '') +
                String(Math.abs(label)).padStart(4, '0') +
                '|' +
                body.slice(indent.length),
            );
          }
        });
      }
    }
  });

  it('rejects malformed Unicode and settings and enforces all budgets', () => {
    assert.equal(numberLinesDetailed('x'.repeat(100_000)).inputLines, 1);
    assert.equal(numberLinesDetailed('x\n'.repeat(10_000)).inputLines, 10_000);
    assert.equal(numberLines('a', 1, 20, '').length, 21);
    for (const start of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => numberLines('a', start), /safe integers/);
    for (const width of [0, -1, 1.5, 21, NaN])
      assert.throws(() => numberLines('a', 1, width), /1 through 20/);
    assert.throws(() => numberLinesDetailed('a', { step: 0.5 }), /safe integers/);
    assert.throws(() => numberLines('x'.repeat(100_001)), /100,000/);
    assert.throws(() => numberLines('x\n'.repeat(10_001)), /10,000/);
    assert.throws(() => numberLines('x\n'.repeat(1_000), 1, 1, 's'.repeat(1_000)), /1,000,000/);
    for (const separator of ['s'.repeat(1_001), '\n', '\r', '\0', '\uD800'])
      assert.throws(() => numberLines('a', 1, 1, separator), /Separator/);
    assert.throws(() => numberLines('\uD800'), /Unicode/);
    assert.throws(() => numberLines('\0'), /NUL/);
  });
});
