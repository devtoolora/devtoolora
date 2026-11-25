import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  jsonArrayToLines,
  jsonLinesToArray,
  parseExactJson,
  stringifyExactJson,
} from '@devtoolora/functions/format';

describe('jsonLinesToArray', () => {
  it('parses records and counts skipped blank lines', () => {
    assert.deepEqual(jsonLinesToArray('{"a":1}\n\n{"a":2}\n'), {
      blankSkipped: 1,
      duplicates: undefined,
      lines: 2,
      value: [{ a: 1 }, { a: 2 }],
    });
  });

  it('accepts CRLF and lone CR separators', () => {
    assert.equal(jsonLinesToArray('1\r\n2').lines, 2);
    assert.equal(jsonLinesToArray('1\r2').lines, 2);
  });

  it('strips a leading BOM', () => {
    assert.deepEqual(jsonLinesToArray('\uFEFF{"a":1}\n2').value, [{ a: 1 }, 2]);
  });

  it('reports the physical line number including blank lines', () => {
    assert.throws(() => jsonLinesToArray('{"a":1}\n{bad'), /Line 2 is not valid JSON/);
    assert.throws(() => jsonLinesToArray('1\n\n\nx'), /Line 4 is not valid JSON: .+\.$/);

    assert.throws(
      () => jsonLinesToArray('1\n\n\nx'),
      (error: Error) => !error.message.endsWith('..'),
    );
  });

  it('rejects empty input and enforces limits', () => {
    assert.throws(() => jsonLinesToArray(' \n'), /JSON Lines input is required/);
    assert.throws(() => jsonLinesToArray('1\n'.repeat(100_001)), /limited to 100,000 lines/);
    assert.throws(() => jsonLinesToArray('1'.repeat(10_000_001)), /10,000,000 UTF-16 units/);
  });
});

describe('strict JSON reading', () => {
  it('gives a clean position instead of an engine message', () => {
    assert.throws(() => jsonLinesToArray('1\n//c'), {
      message:
        'Line 2 is not valid JSON: Expected an object, array, string, number, true, false or null at column 1.',
    });

    assert.throws(() => parseExactJson('['), /Invalid JSON at line 1, column 2/);
  });
});

describe('jsonArrayToLines', () => {
  it('writes one minified value per line', () => {
    assert.equal(jsonArrayToLines([1, { b: 2 }]), '1\n{"b":2}');
    assert.equal(jsonArrayToLines([]), '');
  });

  it('requires a top-level array', () => {
    assert.throws(() => jsonArrayToLines({ a: 1 }), /top-level JSON array/);
  });
});

describe('jsonLinesToArray exact integers', () => {
  it('keeps the digits of an integer a double cannot hold', () => {
    assert.equal(
      stringifyExactJson(jsonLinesToArray('{"id":1}\n{"id":12345678901234567890}').value),
      '[{"id":1},{"id":12345678901234567890}]',
    );
  });

  it('names the line of a number out of range', () => {
    assert.throws(() => jsonLinesToArray('1\n1e-400'), /Line 2: .*range of a double/);
  });
});
