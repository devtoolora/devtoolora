import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { markdownHelperTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Markdown Helper tool', () => {
  it('has complete samples and exports exact clean source or a structured report', async () => {
    assert.equal(contentOf(markdownHelperTool).documentation?.length, 2);

    for (const sample of markdownHelperTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 3);
      const result = await markdownHelperTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      assert.ok(result.summary?.includes('Headings:'));
      if (sample.fields?.output === 'report') {
        assert.equal(result.artifact?.fileName, 'markdown-report.json');
        assert.equal(JSON.parse(result.text).headings, 2);
      } else assert.equal(result.artifact?.fileName, 'cleaned.md');
    }
  });

  it('never appends a statistics footer and validates fields instead of guessing', async () => {
    const result = await markdownHelperTool.run({ fields: {}, text: '# Title\n' });

    assert.equal(result.text, '# Title\n');
    const empty = await markdownHelperTool.run({ fields: {}, text: '' });

    assert.equal(empty.artifact?.base64, '');
    assert.ok(empty.summary?.includes('empty result'));
    const invalidFields: Array<Record<string, string>> = [
      { output: 'html' },
      { stripHtml: 'yes' },
      { collapseWhitespace: '1' },
    ];

    for (const fields of invalidFields)
      await assert.rejects(async () => markdownHelperTool.run({ fields, text: '# Title' }));
  });
});
