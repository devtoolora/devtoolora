import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { json5ToJsonTool, jsoncToJsonTool } from '../src/catalog/formatters/jsonc-to-json/tool';
import { contentOf } from './toolContent';

describe('jsonc to json tool', () => {
  it('converts JSONC and counts comments', async () => {
    const result = await jsoncToJsonTool.run({ fields: {}, text: '{"a":1, // x\n}' });

    assert.equal(result.text, '{\n  "a": 1\n}');
    assert.equal(result.summary, 'Converted to JSON · 1 comment removed.');
    assert.equal(contentOf(jsoncToJsonTool).faq?.length, 5);
  });

  it('defaults the alias to JSON5', async () => {
    const result = await json5ToJsonTool.run({ fields: {}, text: "{a:'x'}" });

    assert.equal(json5ToJsonTool.aliasOf, 'jsonc-to-json');
    assert.equal(json5ToJsonTool.name, 'JSON5 to JSON');
    assert.equal(result.text, '{\n  "a": "x"\n}');
    assert.equal(result.summary, 'Converted to JSON · 0 comments removed.');
  });

  it('reports duplicate keys in the summary', async () => {
    const result = await jsoncToJsonTool.run({ fields: {}, text: '{"a": 1, "a": 2, "a": 3}' });

    assert.equal(result.summary, 'Converted to JSON · 0 comments removed · 2 duplicate keys.');
  });
});
