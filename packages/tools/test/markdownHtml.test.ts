import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { markdownToHtmlTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Markdown to HTML tool', () => {
  it('provides complete resettable samples, useful guides and exact UTF-8 HTML artifacts', async () => {
    assert.equal(contentOf(markdownToHtmlTool).documentation?.length, 2);
    assert.ok((contentOf(markdownToHtmlTool).examples?.length ?? 0) >= 5);

    for (const sample of markdownToHtmlTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 5);
      const result = await markdownToHtmlTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      assert.equal(result.artifact?.fileName, 'markdown.html');
      assert.equal(Boolean(result.htmlPreview), sample.fields?.output === 'preview');
    }
  });

  it('escapes standalone titles, accepts empty output, rejects bad options and preserves editor conversion actions', async () => {
    const result = await markdownToHtmlTool.run({
      fields: { export: 'document', title: '</title><script>bad</script> & 😀' },
      text: '# Hello',
    });

    assert.match(
      result.text,
      /<title>&lt;\/title&gt;&lt;script&gt;bad&lt;\/script&gt; &amp; 😀<\/title>/,
    );

    assert.ok(!result.text.includes('<script>'));
    assert.match(result.text, /^<!doctype html>/);
    assert.match(result.text, /<meta charset="utf-8">/);
    assert.equal((await markdownToHtmlTool.run({ fields: {}, text: '' })).artifact?.base64, '');
    assert.ok(markdownToHtmlTool.resultActions?.includes('replace'));
    assert.ok(markdownToHtmlTool.resultActions?.includes('insert'));
    const invalid: Array<Record<string, string>> = [
      { output: 'pdf' },
      { dialect: 'gfm' },
      { breaks: 'yes' },
      { export: 'page' },
      { export: 'document', title: 'x'.repeat(201) },
      { export: 'document', title: '\ud800' },
    ];

    for (const fields of invalid)
      await assert.rejects(async () => markdownToHtmlTool.run({ fields, text: '' }));
  });
});
