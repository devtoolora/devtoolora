import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import {
  JsonNumberToken,
  parseLosslessJson,
  processJsonDocument,
  stringifyLosslessJson,
} from '@devtoolora/functions/format';

describe('lossless JSON documents', () => {
  it('collects exact tree nodes with escaped pointers, parent IDs, duplicates and typed empty values', () => {
    const tree = processJsonDocument(
      '{"a/b~c":{"":9007199254740993},"a.b":[null,"",{}],"role":1,"role":2}',
      { collectTree: true, mode: 'minify' },
    );

    assert.deepEqual(
      tree.nodes.map((node) => node.id),
      tree.nodes.map((_, index) => index),
    );

    assert.equal(tree.nodes[0]!.parentId, null);
    assert.equal(tree.nodes[0]!.pointer, '');
    assert.equal(tree.nodes[0]!.childCount, 4);
    assert.equal(tree.nodes[2]!.pointer, '/a~1b~0c/');
    assert.equal(tree.nodes[2]!.token, '9007199254740993');
    assert.equal(tree.nodes[2]!.parentId, 1);
    assert.equal(tree.nodes[4]!.pointer, '/a.b/0');
    assert.equal(tree.nodes[4]!.type, 'null');
    assert.equal(tree.nodes[5]!.token, '""');
    assert.equal(tree.nodes[6]!.type, 'object');
    assert.equal(tree.nodes[6]!.childCount, 0);

    assert.deepEqual(
      tree.nodes.slice(-2).map((node) => node.pointer),
      ['/role', '/role'],
    );

    assert.equal(tree.report.duplicateKeys, 1);
    assert.equal(processJsonDocument('{}').nodes.length, 0);

    assert.throws(
      () => processJsonDocument(`[${Array(5_000).fill('0').join(',')}]`, { collectTree: true }),
      /5,000 values/,
    );

    const large = `[${Array(6_000).fill('0').join(',')}]`;

    assert.equal(
      processJsonDocument(large, { collectTree: true, limits: { values: 10_000 } }).nodes.length,
      6_001,
    );
  });

  it('preserves numbers, string tokens, key order and duplicate members exactly', () => {
    const source =
      '{ "10":9007199254740993, "2":1.2300, "zero":-0, "huge":1e400, "tiny":1e-400, "s":"\\u0061", "10":2 }';
    const minified = processJsonDocument(source, { mode: 'minify' });

    assert.equal(
      minified.text,
      '{"10":9007199254740993,"2":1.2300,"zero":-0,"huge":1e400,"tiny":1e-400,"s":"\\u0061","10":2}',
    );

    assert.equal(minified.report.duplicateKeys, 1);
    assert.equal(minified.report.numbersOutsideSafeRange, 3);

    assert.equal(
      processJsonDocument(processJsonDocument(source).text, { mode: 'minify' }).text,
      minified.text,
    );

    assert.equal(processJsonDocument('{"a":1,"\\u0061":2}').report.duplicateKeys, 1);
    assert.equal(processJsonDocument('{"__proto__":1,"constructor":2}').report.duplicateKeys, 0);
  });

  it('supports all root types, exact strings, container counts, tabs and CRLF', () => {
    for (const [source, type] of [
      ['null', 'null'],
      ['false', 'boolean'],
      ['0', 'number'],
      ['"🐎\\n a"', 'string'],
      ['[]', 'array'],
      ['{}', 'object'],
    ] as [string, string][]) {
      assert.equal(processJsonDocument(source).text, source);
      assert.equal(processJsonDocument(source).report.rootType, type);
    }

    const formatted = processJsonDocument('{"a":[{},1],"s":"a\\tb"}', {
      indentation: 'tab',
      lineEnding: 'crlf',
    });

    assert.equal(
      formatted.text,
      '{\r\n\t"a": [\r\n\t\t{},\r\n\t\t1\r\n\t],\r\n\t"s": "a\\tb"\r\n}',
    );

    assert.equal(formatted.report.arrays, 1);
    assert.equal(formatted.report.objects, 2);
    assert.equal(formatted.report.maxDepth, 3);
    assert.equal(formatted.report.values, 5);
    assert.equal(processJsonDocument('"\\uD800"').text, '"\\uD800"');
  });

  it('rejects malformed grammar with useful line and column diagnostics', () => {
    const invalid = [
      '{',
      '[',
      '[1,]',
      '{"a":1,}',
      '{a:1}',
      "{'a':1}",
      '01',
      '-01',
      '+1',
      '.5',
      '1.',
      '1e',
      'NaN',
      'Infinity',
      'undefined',
      'true false',
      '{"a" 1}',
      '{"a":}',
      '[1 2]',
      '/*c*/{}',
      '\u00a0{}',
      '\ufeff\ufeff{}',
      '{}\ufeff',
      '"\\x01"',
      '"\\u012Z"',
      '"\\"',
      '"a\nb"',
    ];

    for (const source of invalid) {
      assert.throws(
        () => processJsonDocument(source),
        (error: unknown) =>
          error instanceof FunctionError &&
          error.code === 'INVALID_JSON' &&
          /line \d+, column \d+/.test(error.message),
        source,
      );
    }

    assert.throws(() => processJsonDocument('{\r\n  "ok": true,\r\n}'), /line 3, column 1/);

    assert.throws(
      () => processJsonDocument(' \n\t'),
      (error: unknown) => error instanceof FunctionError && error.code === 'REQUIRED_JSON',
    );
  });

  it('ignores one leading byte order mark while keeping offsets in the original text', () => {
    assert.equal(processJsonDocument('\ufeff{"a":1}', { mode: 'minify' }).text, '{"a":1}');
    assert.equal(processJsonDocument('\ufeff[1]').text, '[\n  1\n]');
    const tree = processJsonDocument('\ufeff{"a":1}', { collectTree: true, mode: 'minify' });

    assert.deepEqual([tree.nodes[0]!.start, tree.nodes[1]!.start], [1, 6]);

    assert.throws(
      () => processJsonDocument('\ufeff{"a":1,}'),
      /line 1, column 8 \(offset 8\): Trailing commas/,
    );

    assert.throws(() => processJsonDocument('\ufeff\ufeff{}'), /line 1, column 1 \(offset 1\)/);

    assert.throws(
      () => processJsonDocument('\ufeff '),
      (error: unknown) => error instanceof FunctionError && error.code === 'REQUIRED_JSON',
    );
  });

  it('parses converter input with exact number tokens, source key order and named duplicate keys', () => {
    const value = parseLosslessJson(
      '\ufeff{"b":1.00,"2":1e3,"1":9007199254740993,"nested":[-0,{"10":true,"s":"\\u0061"}],"none":null}',
    );

    assert.ok(value instanceof Map);
    assert.deepEqual([...value.keys()], ['b', '2', '1', 'nested', 'none']);
    assert.deepEqual(value.get('b'), new JsonNumberToken('1.00'));
    assert.equal((value.get('1') as JsonNumberToken).text, '9007199254740993');
    assert.equal(value.get('none'), null);

    assert.equal(
      stringifyLosslessJson(value),
      '{"b":1.00,"2":1e3,"1":9007199254740993,"nested":[-0,{"10":true,"s":"a"}],"none":null}',
    );

    assert.equal(parseLosslessJson('"text"'), 'text');
    assert.equal(parseLosslessJson('false'), false);

    assert.throws(
      () => parseLosslessJson('{"role":"user",\n "\\u0072ole":"admin"}'),
      (error: unknown) =>
        error instanceof FunctionError &&
        error.code === 'DUPLICATE_JSON_KEY' &&
        /^Duplicate key "role" at line 2, column 2 \(offset 17\)/.test(error.message),
    );

    assert.throws(() => parseLosslessJson('[1,]'), /Invalid JSON at line 1, column 4/);
    assert.throws(() => parseLosslessJson('[[[0]]]', { depth: 2 }), /2 nested containers/);
    assert.throws(() => parseLosslessJson('[0,0]', { values: 2 }), /2 values/);
    assert.ok(parseLosslessJson(`[${'0,'.repeat(150_000)}0]`));
  });

  it('bounds input, nesting, value counts and warning detail without silently truncating data', () => {
    assert.throws(() => processJsonDocument(' '.repeat(1_000_001)), /1,000,000/);
    assert.ok(processJsonDocument('['.repeat(128) + '0' + ']'.repeat(128)));
    assert.throws(() => processJsonDocument('['.repeat(129) + '0' + ']'.repeat(129)), /128 nested/);
    assert.throws(() => processJsonDocument(`[${'0,'.repeat(100_000)}0]`), /100,000 values/);
    const wideDeepArray = '['.repeat(128) + Array(99_800).fill('0').join(',') + ']'.repeat(128);

    assert.throws(
      () => processJsonDocument(wideDeepArray, { indentation: '4' }),
      /8,000,000 characters/,
    );

    assert.ok(processJsonDocument(wideDeepArray, { mode: 'minify' }));
    const source = `{${Array.from({ length: 25 }, (_, index) => `"a":${index}`).join(',')}}`;
    const document = processJsonDocument(source, { mode: 'minify' });

    assert.equal(document.text, source);
    assert.equal(document.report.duplicateKeys, 24);
    assert.equal(document.report.warnings.length, 20);
  });

  it('matches native JSON syntax for generated safe documents without code generation', () => {
    for (let index = 0; index < 100; index += 1) {
      const source = JSON.stringify({
        array: [index, false, null, {}, []],
        message: `Unicode č 🐎 ${index}\n\\\"`,
        nested: { count: index / 10 },
      });

      assert.deepEqual(JSON.parse(processJsonDocument(source).text), JSON.parse(source));
      assert.equal(processJsonDocument(source, { mode: 'minify' }).text, source);
    }
  });
});
