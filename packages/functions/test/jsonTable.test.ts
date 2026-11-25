import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { tabulateJsonDocument } from '@devtoolora/functions/format';

describe('lossless JSON records table', () => {
  it('aligns sparse columns without confusing missing and empty values', () => {
    const table = tabulateJsonDocument(
      '[{"a":null,"value":""},{"a":false,"b":0},{"value":[],"b":{}},{}]',
    );

    assert.deepEqual(table.columns, ['a', 'value', 'b']);

    assert.deepEqual(table.rows, [
      ['null', '""', null],
      ['false', null, '0'],
      [null, '[]', '{}'],
      [null, null, null],
    ]);

    assert.match(table.markdown, /Missing/);
    assert.deepEqual(tabulateJsonDocument('[]').rows, []);
    assert.deepEqual(tabulateJsonDocument('[{},{}]').rows, [[], []]);
  });

  it('preserves numeric spelling, nested JSON, string escapes and prototype keys', () => {
    const table = tabulateJsonDocument(
      '[{"id":9007199254740993,"n":1.00,"x":1e400,"s":"\\u0061","nested":{"same":1,"same":2},"__proto__":false,"constructor":0}]',
    );

    assert.deepEqual(table.rows[0], [
      '9007199254740993',
      '1.00',
      '1e400',
      '"\\u0061"',
      '{"same":1,"same":2}',
      'false',
      '0',
    ]);

    const escaped = tabulateJsonDocument(
      '[{"a|b":"<img src=x onerror=alert(1)>","":"*text* [link](x) `code` &"}]',
    ).markdown;

    assert.ok(!escaped.includes('<img'));
    assert.ok(!escaped.includes('*text*'));
    assert.ok(escaped.includes('&#124;'));
    assert.ok(escaped.includes('&#60;'));
    assert.ok(escaped.includes('""'));
  });

  it('rejects ambiguous rows, malformed input and excessive tables rather than dropping values', () => {
    for (const input of ['null', '{}', '[null]', '[1]', '[[]]', '[{"a":1},false]'])
      assert.throws(() => tabulateJsonDocument(input), /requires a root array|must be an object/);

    assert.throws(
      () => tabulateJsonDocument('[{"role":1,"\\u0072ole":2}]'),
      /Row 1 has duplicate key/,
    );

    assert.throws(() => tabulateJsonDocument('[{"a":1,}]'), /column/);

    assert.throws(
      () => tabulateJsonDocument(`[${Array(2_001).fill('{}').join(',')}]`),
      /2,000 rows/,
    );

    assert.throws(
      () =>
        tabulateJsonDocument(
          JSON.stringify([
            Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`key${index}`, index])),
          ]),
        ),
      /100 distinct columns/,
    );

    const rows = [
      Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`key${index}`, index])),
      ...Array.from({ length: 1_000 }, () => ({})),
    ];

    assert.throws(() => tabulateJsonDocument(JSON.stringify(rows)), /100,000 cells/);
  });
});
