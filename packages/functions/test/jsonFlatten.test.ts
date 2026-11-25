import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { flattenJson, unflattenJson } from '@devtoolora/functions/format';

const nested = { a: { b: [1, { c: 2 }], e: {} } };

describe('flattenJson', () => {
  it('flattens with dot and bracket notation', () => {
    assert.deepEqual(flattenJson(nested, { arrays: 'index', notation: 'dot' }), {
      'a.b.0': 1,
      'a.b.1.c': 2,
      'a.e': {},
    });

    assert.deepEqual(flattenJson(nested, { arrays: 'index', notation: 'bracket' }), {
      'a.b[0]': 1,
      'a.b[1].c': 2,
      'a.e': {},
    });
  });

  it('keeps arrays as values', () => {
    assert.deepEqual(flattenJson(nested, { arrays: 'keep', notation: 'dot' }), {
      'a.b': [1, { c: 2 }],
      'a.e': {},
    });
  });

  it('handles root leaves', () => {
    assert.deepEqual(flattenJson(5, { arrays: 'index', notation: 'dot' }), { '': 5 });
    assert.deepEqual(flattenJson([], { arrays: 'index', notation: 'dot' }), { '': [] });
  });

  it('quotes separator keys in bracket notation and rejects them in dot notation', () => {
    assert.deepEqual(flattenJson({ 'x.y': 1 }, { arrays: 'index', notation: 'bracket' }), {
      '["x.y"]': 1,
    });

    assert.throws(
      () => flattenJson({ 'x.y': 1 }, { arrays: 'index', notation: 'dot' }),
      /Key "x.y" contains a separator; use bracket notation\./,
    );
  });

  it('escapes quotes and backslashes like JSON strings and round-trips them', () => {
    const value = { 'a"b.c': { 'd\\e': [1] }, plain: { '': 2 } };
    const flat = flattenJson(value, { arrays: 'index', notation: 'bracket' });

    assert.deepEqual(flat, { '["a\\"b.c"]["d\\\\e"][0]': 1, 'plain[""]': 2 });
    assert.deepEqual(unflattenJson(flat, { notation: 'bracket' }), value);
  });

  it('limits nesting to 64 levels', () => {
    let deep: unknown = 1;

    for (let i = 0; i < 65; i += 1) deep = { a: deep };

    assert.throws(
      () => flattenJson(deep as never, { arrays: 'index', notation: 'dot' }),
      /Nesting is limited to 64 levels\./,
    );
  });
});

describe('unflattenJson', () => {
  it('rebuilds nested values', () => {
    assert.deepEqual(
      unflattenJson({ 'a.b.0': 1, 'a.b.1.c': 2, 'a.e': {} }, { notation: 'dot' }),
      nested,
    );

    assert.deepEqual(
      unflattenJson({ 'a.b[0]': 1, 'a.b[1].c': 2, 'a.e': {} }, { notation: 'bracket' }),
      nested,
    );
  });

  it('uses objects when indexes are not a dense 0..n-1 run', () => {
    assert.deepEqual(unflattenJson({ 'a.1': 'x', 'a.2': 'y' }, { notation: 'dot' }), {
      a: { '1': 'x', '2': 'y' },
    });

    assert.deepEqual(unflattenJson({ 'a.0': 'x', 'a.b': 'y' }, { notation: 'dot' }), {
      a: { '0': 'x', b: 'y' },
    });
  });

  it('treats prototype names as own data properties', () => {
    const result = unflattenJson(
      { '__proto__.x': 1, 'constructor.prototype.y': 2 },
      { notation: 'dot' },
    ) as Record<string, unknown>;

    assert.equal(Object.hasOwn(result, '__proto__'), true);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(({} as Record<string, unknown>).x, undefined);
    assert.equal(({} as Record<string, unknown>).y, undefined);

    assert.deepEqual(JSON.parse(JSON.stringify(result)), {
      constructor: { prototype: { y: 2 } },
      ['__proto__']: { x: 1 },
    });
  });

  it('rejects conflicts, bad paths and oversized nesting', () => {
    assert.throws(() => unflattenJson({ a: 1, 'a.b': 2 }, { notation: 'dot' }), /Conflicting/);
    assert.throws(() => unflattenJson({ 'a[': 1 }, { notation: 'bracket' }), /Invalid key path/);

    assert.throws(
      () => unflattenJson({ [`${'a.'.repeat(64)}a`]: 1 }, { notation: 'dot' }),
      /Nesting is limited to 64 levels\./,
    );
  });
});
