import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  duplicateKeysWarning,
  flattenJson,
  JsonNumberToken,
  jsonArrayToLines,
  jsonLinesToArray,
  parseExactJson,
  parseJson,
  parseJsonExactIntegers,
  parseLosslessJson,
  parseLosslessJsonData,
  stringifyExactJson,
  unflattenJson,
} from '../src/format';

const big = '12345678901234567890';

describe('duplicate keys in data input', () => {
  it('keeps the last value in the position of the first, as JSON.parse does', () => {
    const { duplicates, value } = parseLosslessJsonData('{"a":1,\n"b":2,\n"a":3}');

    assert.deepEqual(duplicates, { count: 1, key: 'a', line: 3 });
    assert.ok(value instanceof Map);
    assert.deepEqual([...value.keys()], ['a', 'b']);
    assert.equal(stringifyExactJson(parseExactJson('{"a":1,"b":2,"a":3}').value), '{"a":3,"b":2}');
  });

  it('names the first key and line and counts the rest', () => {
    const { duplicates } = parseLosslessJsonData('{"a":1,"a":2,\n"b":1,\n"b":2,"b":3}');

    assert.equal(
      duplicateKeysWarning(duplicates),
      'Duplicate key "a" at line 1 and 2 more; only the last value of each is kept.',
    );

    assert.equal(
      duplicateKeysWarning({ count: 1, key: 'a', line: 4 }, 'was checked'),
      'Duplicate key "a" at line 4; only its last value was checked.',
    );

    assert.equal(duplicateKeysWarning(undefined), undefined);
  });

  it('clips a long key in the warning', () => {
    const key = 'k'.repeat(500);
    const warning = duplicateKeysWarning({ count: 1, key, line: 1 }) ?? '';

    assert.ok(warning.length < 150);
  });

  it('still rejects them in the strict parser', () => {
    assert.throws(() => parseLosslessJson('{"a":1,"a":2}'), /Duplicate key "a" at line 1/);
  });

  it('warns for JSON Lines with the line of the record', () => {
    const result = jsonLinesToArray('{"a":1}\n\n{"a":1,"a":2}\n{"b":1,"b":2}');

    assert.deepEqual(result.duplicates, { count: 2, key: 'a', line: 3 });
    assert.deepEqual(result.value, [{ a: 1 }, { a: 2 }, { b: 2 }]);
    assert.equal(jsonLinesToArray('{"a":1}').duplicates, undefined);
  });
});

describe('numbers outside the range of a double', () => {
  it('rejects overflow and underflow in the shared parsers', () => {
    for (const text of [
      '[1e400]',
      '[-1e400]',
      '[1e-400]',
      '[-1.5e-400]',
      `[0.${'0'.repeat(400)}1]`,
    ]) {
      assert.throws(() => parseJsonExactIntegers(text), /range of a double/, text);
      assert.throws(() => parseExactJson(text), /range of a double/, text);
    }
  });

  it('leaves real zeros and look-alike strings alone', () => {
    assert.deepEqual(parseJsonExactIntegers('[0,0.0,0e5,-0.0e-400,"1e-400","\\"1e400"]'), [
      0,
      0,
      0,
      -0,
      '1e-400',
      '"1e400',
    ]);
  });

  it('can keep them when a value is only displayed', () => {
    const value = parseExactJson('[1e400,1e-400]', { keepOutOfRange: true }).value;

    assert.equal(stringifyExactJson(value), '[1e400,1e-400]');
  });
});

describe('exact JSON', () => {
  it('keeps numbers a double cannot hold and reads the others as numbers', () => {
    const { value } = parseExactJson(`{"big":${big},"long":1.2345678901234567890123,"n":1.50}`);

    assert.equal(
      stringifyExactJson(value),
      `{"big":${big},"long":1.2345678901234567890123,"n":1.5}`,
    );

    assert.ok(Array.isArray(parseExactJson('[1e21]').value));

    assert.deepEqual(
      parseExactJson('[1e21,9007199254740992,1.5e300]').value,
      [1e21, 9007199254740992, 1.5e300],
    );
  });

  it('prints a kept number with String', () => {
    assert.equal(String(new JsonNumberToken(big)), big);
  });

  it('writes what JSON.stringify writes when nothing needs keeping', () => {
    const value = { a: [1, { b: null }, []], c: {}, d: 'x"y', e: true, f: undefined };

    assert.equal(stringifyExactJson(value), JSON.stringify(value));
    assert.equal(stringifyExactJson(value, 2), JSON.stringify(value, null, 2));
    assert.equal(stringifyExactJson(value, '\t'), JSON.stringify(value, null, '\t'));
  });

  it('keeps a __proto__ key as plain data', () => {
    const { value } = parseExactJson('{"__proto__":{"x":1}}');

    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    assert.equal(stringifyExactJson(value), '{"__proto__":{"x":1}}');
  });

  it('passes through flatten and unflatten', () => {
    const { value } = parseExactJson(`{"a":{"b":${big}}}`);
    const flat = flattenJson(value, { arrays: 'index', notation: 'dot' });

    assert.equal(stringifyExactJson(flat), `{"a.b":${big}}`);

    assert.equal(
      stringifyExactJson(unflattenJson(flat, { notation: 'dot' })),
      `{"a":{"b":${big}}}`,
    );
  });

  it('passes through JSON Lines in both directions', () => {
    assert.equal(stringifyExactJson(jsonLinesToArray(`{"id":${big}}`).value), `[{"id":${big}}]`);

    assert.equal(
      jsonArrayToLines(parseExactJson(`[{"id":${big}},${big}]`).value),
      `{"id":${big}}\n${big}`,
    );
  });
});

describe('parseJson', () => {
  it('still parses with last value wins and no warning machinery', () => {
    assert.deepEqual(parseJson('{"a":1,"a":2}'), { a: 2 });
  });
});
