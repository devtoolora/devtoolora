import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { compareJsonDocuments } from '@devtoolora/functions/format';
import { FunctionError } from '@devtoolora/functions/errors';

describe('precise structural JSON diff', () => {
  it('ignores object order and equivalent string escapes, but not arrays or types', () => {
    assert.equal(compareJsonDocuments('{"a":1,"b":"\\u0061"}', '{"b":"a","a":1}').equal, true);

    assert.deepEqual(compareJsonDocuments('[1,2]', '[1,3,4]').changes, [
      { after: '3', before: '2', kind: 'changed', pointer: '/1' },
      { after: '4', kind: 'added', pointer: '/2' },
    ]);

    assert.deepEqual(compareJsonDocuments('{"a":null}', '{}').changes, [
      { before: 'null', kind: 'removed', pointer: '/a' },
    ]);

    assert.deepEqual(compareJsonDocuments('null', '[]').changes, [
      { after: '[]', before: 'null', kind: 'changed', pointer: '' },
    ]);

    assert.equal(compareJsonDocuments('"é"', '"e\\u0301"').equal, false);
  });

  it('compares exact decimal values without rounding or exponent expansion', () => {
    for (const [left, right] of [
      ['1.00', '10e-1'],
      ['-0', '0.0'],
      ['1e400', '10e399'],
      ['0.0001', '1e-4'],
      ['-12300', '-1.23e4'],
      ['1e999999999999999999999999', '10e999999999999999999999998'],
    ] as [string, string][]) {
      assert.equal(compareJsonDocuments(left, right).equal, true, `${left} and ${right}`);
      assert.equal(compareJsonDocuments(left, right, 'token').equal, false);
    }

    for (const [left, right] of [
      ['9007199254740992', '9007199254740993'],
      ['1.0000000000000000001', '1'],
      ['1e-400', '0'],
      ['-1', '1'],
    ] as [string, string][]) {
      assert.equal(compareJsonDocuments(left, right).equal, false);
    }

    const huge = `1e${'9'.repeat(1_001)}`;

    assert.throws(() => compareJsonDocuments(huge, huge), /1,000 digits/);
    assert.equal(compareJsonDocuments(huge, huge, 'token').equal, true);
  });

  it('escapes pointers and exports exact complete containers without inherited-key confusion', () => {
    const diff = compareJsonDocuments(
      '{"__proto__":{},"a/b~c":1}',
      '{"a/b~c":2,"__proto__":{"id":9007199254740993},"new":[1.00,{"a":null}]}',
    );

    assert.deepEqual(diff.changes, [
      { after: '9007199254740993', kind: 'added', pointer: '/__proto__/id' },
      { after: '2', before: '1', kind: 'changed', pointer: '/a~1b~0c' },
      { after: '[1.00,{"a":null}]', kind: 'added', pointer: '/new' },
    ]);

    assert.equal(diff.added, 2);
    assert.equal(diff.changed, 1);
    assert.equal(diff.removed, 0);
    assert.deepEqual(compareJsonDocuments('{"":1}', '{"":2}').changes[0]!.pointer, '/');
  });

  it('rejects ambiguous members, invalid sides and input limits explicitly', () => {
    assert.throws(
      () => compareJsonDocuments('{"a":1,"\\u0061":2}', '{}'),
      (error: unknown) =>
        error instanceof FunctionError &&
        error.code === 'AMBIGUOUS_JSON_DIFF' &&
        /Left JSON/.test(error.message),
    );

    assert.throws(
      () => compareJsonDocuments('{}', '{\n"a":1,\n}'),
      /Right JSON:.*line 3, column 1/,
    );

    assert.throws(() => compareJsonDocuments('', '{}'), /Left JSON: JSON input is required/);

    assert.throws(
      () => compareJsonDocuments(`[${Array(5_000).fill('0').join(',')}]`, '[]'),
      /Left JSON:.*5,000/,
    );

    const prefix = 'x'.repeat(1_700);
    const left = JSON.stringify({
      [prefix]: Object.fromEntries(Array.from({ length: 2_500 }, (_, index) => [`a${index}`, 0])),
    });
    const right = JSON.stringify({
      [prefix]: Object.fromEntries(Array.from({ length: 2_500 }, (_, index) => [`b${index}`, 0])),
    });

    assert.throws(() => compareJsonDocuments(left, right), /8,000,000 value\/path characters/);
  });
});
