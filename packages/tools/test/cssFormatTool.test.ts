import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cssFormatTool } from '../src/catalog/formatters/css-format/tool';
import { contentOf } from './toolContent';

describe('css format tool', () => {
  it('formats and counts rules', async () => {
    const result = await cssFormatTool.run({ fields: {}, text: 'a{color:red}' });

    assert.equal(result.text, 'a {\n  color: red;\n}\n');
    assert.equal(result.summary, 'CSS formatted · 1 rule.');
    assert.equal(contentOf(cssFormatTool).faq?.length, 5);
  });

  it('minifies', async () => {
    const result = await cssFormatTool.run({
      fields: { mode: 'minify' },
      text: 'a { b: c }\nd { e: f }',
    });

    assert.equal(result.text, 'a{b:c}d{e:f}');
    assert.equal(result.summary, 'CSS minified · 2 rules.');
  });
});
