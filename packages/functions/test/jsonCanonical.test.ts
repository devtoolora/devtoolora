import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  canonicalizeJson,
  jsonLinesToArray,
  parseJson,
  sortJsonKeys,
  type JsonValue,
} from '@devtoolora/functions/format';

describe('canonicalizeJson', () => {
  it('sorts keys and drops whitespace', () => {
    assert.equal(
      canonicalizeJson({ b: 1, a: { d: [2, 1], c: 'é' } }),
      '{"a":{"c":"é","d":[2,1]},"b":1}',
    );
  });

  it('matches the RFC 8785 section 3.2.3 example', () => {
    const rfc8785 = {
      literals: [null, true, false],
      numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
      string: '€$\u000F\nA\'B"\\\\"/',
    };

    assert.equal(
      canonicalizeJson(rfc8785),
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it('sorts by UTF-16 code units, not code points or locale', () => {
    assert.equal(canonicalizeJson({ é: 1, z: 2, a: 3 }), '{"a":3,"z":2,"é":1}');
    assert.equal(canonicalizeJson({ Z: 1, a: 2 }), '{"Z":1,"a":2}');
    // U+1F600 (surrogates D83D DE00) sorts before U+FF5E (FF5E).
    assert.equal(canonicalizeJson({ '～': 1, '\u{1F600}': 2 }), '{"\u{1F600}":2,"～":1}');
  });

  it('writes negative zero as 0', () => {
    assert.equal(canonicalizeJson([-0, 0]), '[0,0]');
  });

  it('rejects nesting beyond 64 levels', () => {
    assert.throws(() => canonicalizeJson(parseJson('['.repeat(65) + ']'.repeat(65))), /64 levels/);
    assert.doesNotThrow(() => canonicalizeJson(parseJson('['.repeat(64) + ']'.repeat(64))));
  });
});

describe('sortJsonKeys', () => {
  const sort = (value: JsonValue, order: 'asc' | 'desc' = 'asc', indentation: 2 | 4 | 'tab' = 2) =>
    sortJsonKeys(value, { indentation, order });

  it('sorts recursively and keeps array order', () => {
    assert.equal(
      sort({ b: [{ y: 1, x: 2 }], a: 0 }),
      '{\n  "a": 0,\n  "b": [\n    {\n      "x": 2,\n      "y": 1\n    }\n  ]\n}',
    );

    assert.equal(sort({ a: 1, b: 2 }, 'desc', 4), '{\n    "b": 2,\n    "a": 1\n}');
    assert.equal(sort({ a: [], b: {} }, 'asc', 'tab'), '{\n\t"a": [],\n\t"b": {}\n}');
    assert.equal(sort([3, 1, 2]), '[\n  3,\n  1,\n  2\n]');
  });

  it('orders integer-like keys by code unit too', () => {
    const value = parseJson('{"b":1,"a":2,"10":3,"9":4,"Z":5}');
    const keysOf = (text: string) => [...text.matchAll(/"(\w+)":/g)].map((match) => match[1]);

    assert.deepEqual(keysOf(sort(value)), ['10', '9', 'Z', 'a', 'b']);
    assert.deepEqual(keysOf(sort(value, 'desc')), ['b', 'a', 'Z', '9', '10']);
  });

  it('keeps __proto__ as a plain key', () => {
    assert.equal(sort(parseJson('{"a":2,"__proto__":1}')), '{\n  "__proto__": 1,\n  "a": 2\n}');
  });
});

describe('numbers beyond the double range', () => {
  it('are errors instead of null', () => {
    for (const text of ['{"a":1e400}', '[-1e400]'])
      assert.throws(() => parseJson(text, { exactIntegers: true }), /range of a double/);

    assert.throws(() => jsonLinesToArray('{"a":1e400}'), /Line 1: .*range of a double/);
    assert.throws(() => canonicalizeJson(parseJson('{"a":1e400}')), /RFC 8785/);
    assert.throws(() => canonicalizeJson(parseJson('[-1e400]')), /RFC 8785/);
  });

  it('include a non-zero literal that would become 0', () => {
    assert.throws(() => parseJson('[1.5,1e-400]', { exactIntegers: true }), /range of a double/);
    assert.throws(() => jsonLinesToArray('{"a":1e-400}'), /Line 1: .*range of a double/);
  });

  it('leave numbers inside the range alone', () => {
    assert.deepEqual(parseJson('[1.5,0e-400,1e-300]', { exactIntegers: true }), [1.5, 0, 1e-300]);
  });
});

describe('canonical strings', () => {
  it('rejects unpaired surrogates in values and keys', () => {
    assert.throws(() => canonicalizeJson(parseJson('"\\ud83d"')), /surrogate/);
    assert.throws(() => canonicalizeJson(parseJson('"\\ude00a"')), /surrogate/);
    assert.throws(() => canonicalizeJson(parseJson('{"\\ud83d":1}')), /surrogate/);
    assert.equal(canonicalizeJson(parseJson('"\\ud83d\\ude00"')), '"\u{1F600}"');
  });

  it('leaves unpaired surrogates to sort mode', () => {
    assert.equal(
      sortJsonKeys(parseJson('"\\ud83d"'), { indentation: 2, order: 'asc' }),
      '"\\ud83d"',
    );
  });
});
