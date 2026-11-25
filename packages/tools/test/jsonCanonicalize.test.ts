import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonCanonicalizeTool } from '../src/catalog/formatters';

describe('json canonicalize tool', () => {
  it('sorts keys with the chosen indentation', async () => {
    const result = await jsonCanonicalizeTool.run({
      fields: { indentation: 'tab' },
      text: '{"b":1,"a":2}',
    });

    assert.equal(result.text, '{\n\t"a": 2,\n\t"b": 1\n}');
    assert.match(result.summary ?? '', /asc · 2 keys sorted/);
    assert.equal(result.artifact?.fileName, 'sorted.json');
  });

  it('sorts descending', async () => {
    const result = await jsonCanonicalizeTool.run({
      fields: { indentation: '2', order: 'desc' },
      text: '{"a":1,"b":2}',
    });

    assert.equal(result.text, '{\n  "b": 2,\n  "a": 1\n}');
  });

  it('canonicalizes and ignores sort-only fields', async () => {
    const result = await jsonCanonicalizeTool.run({
      fields: { indentation: 'bogus', mode: 'canonical', order: 'bogus' },
      text: '{"b":1,"a":2}',
    });

    assert.equal(result.text, '{"a":2,"b":1}');
    assert.match(result.summary ?? '', /RFC 8785 · 13 UTF-8 bytes/);
    assert.equal(result.artifact?.fileName, 'canonical.json');
  });

  it('reports readable errors', async () => {
    await assert.rejects(async () => jsonCanonicalizeTool.run({ fields: {}, text: '{' }), /JSON/);

    await assert.rejects(
      async () => jsonCanonicalizeTool.run({ fields: { order: 'x' }, text: '{}' }),
      /Choose/,
    );
  });

  it('rejects unsafe integers when sorting but keeps RFC 8785 doubles', async () => {
    const text = '{"id":9007199254740993}';

    await assert.rejects(
      async () => jsonCanonicalizeTool.run({ fields: {}, text }),
      /Quote integers outside ±9,007,199,254,740,991/,
    );

    const canonical = await jsonCanonicalizeTool.run({ fields: { mode: 'canonical' }, text });

    assert.equal(canonical.text, '{"id":9007199254740992}');
  });
});
