import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { markdownTocTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('markdown toc tool', () => {
  it('builds a table of contents and counts headings', async () => {
    const result = await markdownTocTool.run({ fields: {}, text: '## A\n## A' });

    assert.equal(result.text, '- [A](#a)\n- [A](#a-1)');
    assert.equal(result.summary, '2 headings');
    assert.equal((await markdownTocTool.run({ fields: {}, text: '## A' })).summary, '1 heading');
    assert.ok(contentOf(markdownTocTool).faq?.length);
  });
});
