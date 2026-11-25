import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { applyJsonPatch, generateJsonPatch, processJsonDocument } from '../src/format';

const ops = (a: string, b: string) => generateJsonPatch(a, b).text;
const format = (text: string) =>
  processJsonDocument(text, { indentation: '2', mode: 'format' }).text;

describe('json patch', () => {
  it('generates add, remove and replace in an order that applies', () => {
    assert.equal(
      ops('{"a":1,"b":[1,2,3]}', '{"a":2,"b":[1],"c":"x"}'),
      '[\n  {"op":"replace","path":"/a","value":2},\n  {"op":"remove","path":"/b/2"},\n  {"op":"remove","path":"/b/1"},\n  {"op":"add","path":"/c","value":"x"}\n]',
    );

    assert.equal(ops('{"n":1.0}', '{"n":1e0}'), '[]');
    assert.equal(ops('[]', '{}'), '[\n  {"op":"replace","path":"","value":{}}\n]');

    assert.equal(
      ops('{"a/b":1,"m~n":1}', '{"a/b":2,"m~n":2}'),
      '[\n  {"op":"replace","path":"/a~1b","value":2},\n  {"op":"replace","path":"/m~0n","value":2}\n]',
    );

    assert.match(ops('{"n":1}', '{"n":9007199254740993}'), /"value":9007199254740993/);
  });

  it('keeps the last value of a duplicate key in a document, but not in the operations', () => {
    assert.equal(
      format(applyJsonPatch('{"a":1,"a":2,"b":1}', '[{"op":"test","path":"/a","value":2}]').text),
      format('{"a":2,"b":1}'),
    );

    assert.equal(ops('{"a":1,"a":2}', '{"a":2}'), '[]');
    assert.equal(ops('{"a":2}', '{"a":1,"a":3}'), '[\n  {"op":"replace","path":"/a","value":3}\n]');

    assert.throws(
      () => applyJsonPatch('{}', '[{"op":"add","op":"remove","path":"/a"}]'),
      /^FunctionError: JSON Patch: Duplicate key "op" at line 1/,
    );
  });

  it('names the original and target inputs in generate errors', () => {
    assert.throws(() => generateJsonPatch('{"a":1}', '{"a":'), {
      message: /^Target JSON: Invalid JSON at line 1/,
    });

    assert.throws(() => generateJsonPatch('{', '{}'), {
      message: /^Original JSON: Invalid JSON at line 1/,
    });
  });

  it('round-trips generated patches', () => {
    for (const [a, b] of [
      ['{"a":1,"b":[1,2,3]}', '{"a":2,"b":[1],"c":"x"}'],
      ['[1,2,3,4]', '[4]'],
      ['{"x":{"a/b":[1,{"k":2}]}}', '{"x":{"a/b":[{"k":3}]},"m~n":null}'],
      ['[]', '{"a":[]}'],
    ] as [string, string][])
      assert.equal(applyJsonPatch(a, generateJsonPatch(a, b).text).text, format(b));
  });

  it('applies RFC 6902 operations', () => {
    const apply = (doc: string, patch: string) => applyJsonPatch(doc, patch).text;

    assert.equal(
      apply('{"foo":["bar","baz"]}', '[{"op":"add","path":"/foo/1","value":"qux"}]'),
      format('{"foo":["bar","qux","baz"]}'),
    );

    assert.equal(
      apply('{"foo":[1]}', '[{"op":"add","path":"/foo/-","value":2}]'),
      format('{"foo":[1,2]}'),
    );

    assert.equal(
      apply('{"a":{"b":1},"c":{}}', '[{"op":"move","from":"/a/b","path":"/c/d"}]'),
      format('{"a":{},"c":{"d":1}}'),
    );

    assert.equal(
      apply('{"a":[1]}', '[{"op":"copy","from":"/a","path":"/b"}]'),
      format('{"a":[1],"b":[1]}'),
    );

    assert.equal(
      apply('{"n":1.50}', '[{"op":"add","path":"/m","value":2.0}]'),
      '{\n  "n": 1.50,\n  "m": 2.0\n}',
    );

    assert.equal(
      apply(
        '{"/":1,"~":2}',
        '[{"op":"remove","path":"/~1"},{"op":"replace","path":"/~0","value":3}]',
      ),
      format('{"~":3}'),
    );

    assert.equal(
      apply(
        '{"n":1.0,"o":{"a":1,"b":2}}',
        '[{"op":"test","path":"/n","value":1e0},{"op":"test","path":"/o","value":{"b":2,"a":1}}]',
      ),
      format('{"n":1.0,"o":{"a":1,"b":2}}'),
    );

    assert.equal(
      applyJsonPatch('{}', '[{"op":"add","path":"/a","value":1,"extra":true}]').applied,
      1,
    );
  });

  it('names the failing operation', () => {
    const fails = (doc: string, patch: string, message: RegExp) =>
      assert.throws(() => applyJsonPatch(doc, patch), { message });

    fails(
      '{"baz":"qux"}',
      '[{"op":"test","path":"/baz","value":"bar"}]',
      /^Operation 1 \(test \/baz\): value differs\.$/,
    );

    fails(
      '{"foo":"bar"}',
      '[{"op":"add","path":"/baz/bat","value":"qux"}]',
      /^Operation 1 \(add \/baz\/bat\): parent does not exist\.$/,
    );

    fails(
      '{"a":[1,2]}',
      '[{"op":"add","path":"/a/3","value":0}]',
      /^Operation 1 \(add \/a\/3\): array index 3 is out of range 0-2\.$/,
    );

    fails('{"a":[1]}', '[{"op":"remove","path":"/a/01"}]', /array index/);

    fails(
      '{"a":{}}',
      '[{"op":"move","from":"/a","path":"/a/b"}]',
      /from cannot be a parent of path/,
    );

    fails('{}', '[{"op":"remove","path":"/x"}]', /path does not exist/);
    fails('{}', '[{"op":"add","path":"/x"}]', /^Operation 1 \(add \/x\): value is missing\.$/);

    fails(
      '{}',
      '[{"op":"merge","path":"/x"}]',
      /^Operation 1: op must be add, remove, replace, move, copy or test\.$/,
    );

    fails(
      '{}',
      '[{"op":"add","path":"x","value":1}]',
      /^Operation 1: path must be empty or start with \/\.$/,
    );

    fails('{}', '[{"op":"add","path":"/~2","value":1}]', /~ not followed by 0 or 1/);
    fails('{}', '{}', /^A JSON Patch must be an array of operations\.$/);

    fails(
      '{}',
      JSON.stringify(Array.from({ length: 10_001 }, () => ({ op: 'test', path: '', value: {} }))),
      /limited to 10,000 operations/,
    );
  });

  it('bounds nesting and copied values', () => {
    const deepPath = '/0'.repeat(100);
    const deepValue = `${'['.repeat(40)}${']'.repeat(40)}`;

    assert.throws(
      () =>
        applyJsonPatch(
          `${'['.repeat(100)}${']'.repeat(100)}`,
          `[{"op":"add","path":"${deepPath}","value":${deepValue}}]`,
        ),
      { message: /^Operation 1 \(add [/0]+\): the result is limited to 128 nesting levels\.$/ },
    );

    const doubling = JSON.stringify(
      Array.from({ length: 40 }, (_, index) => ({ from: '', op: 'copy', path: `/${index}` })),
    );

    assert.throws(() => applyJsonPatch(`{"s":"${'x'.repeat(1_000)}"}`, doubling), {
      message: /copied values are limited to 5,000,000 characters in total\.$/,
    });
  });
});
