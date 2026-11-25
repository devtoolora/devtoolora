import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonFlattenTool } from '../src/catalog/formatters';

describe('json flatten tool', () => {
  it('flattens by default', async () => {
    const result = await jsonFlattenTool.run({ fields: {}, text: '{"a":{"b":[1]}}' });

    assert.equal(result.text, '{\n  "a.b.0": 1\n}');
    assert.match(result.summary ?? '', /1 keys · dot notation · depth 3/);
    assert.equal(result.artifact?.fileName, 'flattened.json');
  });

  it('unflattens and ignores arrays outside flatten mode', async () => {
    const result = await jsonFlattenTool.run({
      fields: { arrays: 'bogus', mode: 'unflatten' },
      text: '{"a.b.0":1}',
    });

    assert.deepEqual(JSON.parse(result.text), { a: { b: [1] } });
    assert.equal(result.artifact?.fileName, 'unflattened.json');
  });

  it('reports readable errors', async () => {
    await assert.rejects(async () => jsonFlattenTool.run({ fields: {}, text: '{' }), /JSON/);

    await assert.rejects(
      async () => jsonFlattenTool.run({ fields: { mode: 'unflatten' }, text: '[1]' }),
      /JSON object/,
    );

    await assert.rejects(
      async () => jsonFlattenTool.run({ fields: { arrays: 'x' }, text: '{}' }),
      /Choose/,
    );
  });

  it('keeps the digits of big integers in both modes', async () => {
    for (const mode of ['flatten', 'unflatten']) {
      const result = await jsonFlattenTool.run({
        fields: { mode },
        text: '{"a":9007199254740993}',
      });

      assert.equal(result.text, '{\n  "a": 9007199254740993\n}');
    }
  });

  it('warns about a duplicate key and keeps its last value in both modes', async () => {
    for (const mode of ['flatten', 'unflatten']) {
      const result = await jsonFlattenTool.run({ fields: { mode }, text: '{"a":1,\n"a":2}' });

      assert.deepEqual(JSON.parse(result.text ?? ''), { a: 2 });

      assert.match(
        result.summary ?? '',
        /Duplicate key "a" at line 2; only its last value is kept\.$/,
      );
    }
  });

  it('rejects a bare big number when unflattening', async () => {
    await assert.rejects(
      async () =>
        jsonFlattenTool.run({ fields: { mode: 'unflatten' }, text: '12345678901234567890' }),
      /expects a JSON object/,
    );
  });
});
