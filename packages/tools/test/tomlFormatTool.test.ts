import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { tomlFormatTool } from '../src/catalog/formatters/toml-format/tool';
import { contentOf } from './toolContent';

describe('toml format tool', () => {
  it('formats and reports removed comments', async () => {
    const result = await tomlFormatTool.run({ fields: {}, text: '# a\n# b\nx=1' });

    assert.equal(result.text, 'x = 1\n');
    assert.equal(result.summary, 'TOML formatted · 2 comments removed.');
    assert.ok(contentOf(tomlFormatTool).faq?.length);
  });

  it('validates without changing the text', async () => {
    const text = 'x=1 # c\n';
    const result = await tomlFormatTool.run({ fields: { mode: 'validate' }, text });

    assert.equal(result.text, text);
    assert.equal(result.summary, 'Valid TOML · 1 comment.');
  });

  it('rejects invalid TOML with a position', async () => {
    await assert.rejects(async () => tomlFormatTool.run({ fields: {}, text: 'a = ' }), {
      message: /line 1, column/,
    });
  });

  it('only lists values the formatter really refuses', () => {
    const answers = (contentOf(tomlFormatTool).faq ?? []).map((entry) => entry.answer).join(' ');

    assert.doesNotMatch(answers, /inf and nan are refused/);
  });
});
