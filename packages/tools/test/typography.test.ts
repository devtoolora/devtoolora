import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { typographyFixerTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('typography fixer tool', () => {
  it('curls quotes by default and reports replacements', async () => {
    const result = await typographyFixerTool.run({ fields: {}, text: '"x"' });

    assert.equal(result.text, '\u201Cx\u201D');
    assert.equal(result.summary, '2 replacements');

    assert.equal(
      (await typographyFixerTool.run({ fields: {}, text: '...' })).summary,
      '1 replacement',
    );

    assert.ok(contentOf(typographyFixerTool).faq?.length);
  });
});
