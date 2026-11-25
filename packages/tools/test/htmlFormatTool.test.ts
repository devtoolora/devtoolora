import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { htmlFormatTool } from '../src/catalog/formatters/html-format/tool';
import { contentOf } from './toolContent';

describe('html format tool', () => {
  it('formats and counts closed elements', async () => {
    const result = await htmlFormatTool.run({ fields: {}, text: '<div><span>x</div>' });

    assert.equal(result.text, '<div><span>x</span></div>\n');
    assert.equal(result.summary, 'HTML formatted · 1 unclosed element closed.');
    assert.equal(contentOf(htmlFormatTool).faq?.length, 5);
  });

  it('minifies', async () => {
    const result = await htmlFormatTool.run({
      fields: { mode: 'minify' },
      text: '<ul>\n  <li>a</li>\n</ul>',
    });

    assert.equal(result.text, '<ul><li>a</li></ul>');
    assert.equal(result.summary, 'HTML minified · 0 unclosed elements closed.');
  });
});
