import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { htmlToMarkdownTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

const decoded = (base64: string | undefined) =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('html to markdown tool', () => {
  it('declares its metadata', () => {
    assert.equal(htmlToMarkdownTool.id, 'html-to-markdown');
    assert.equal(htmlToMarkdownTool.name, 'HTML to Markdown');
    assert.equal(htmlToMarkdownTool.category, 'Text');
    assert.equal(htmlToMarkdownTool.inputKind, 'text');
    assert.equal(htmlToMarkdownTool.outputKind, 'markdown');
    assert.equal(htmlToMarkdownTool.supportsSelection, true);
    assert.deepEqual(htmlToMarkdownTool.fields ?? [], []);

    assert.deepEqual(htmlToMarkdownTool.relatedToolIds, [
      'html-to-text',
      'markdown-to-html',
      'html-format',
    ]);

    assert.equal(contentOf(htmlToMarkdownTool).faq?.length, 4);
    assert.ok((htmlToMarkdownTool.samples?.length ?? 0) >= 6);
  });

  it('converts HTML and reports dropped tags', async () => {
    const result = await htmlToMarkdownTool.run({ fields: {}, text: '<h2>T</h2><p>x</p>' });

    assert.equal(result.text, '## T\n\nx\n');
    assert.equal(result.summary, '3 lines of Markdown.');
    assert.equal(result.language, 'markdown');
    assert.equal(result.artifact?.fileName, 'converted.md');
    assert.equal(decoded(result.artifact?.base64), result.text);

    const dropped = await htmlToMarkdownTool.run({
      fields: {},
      text: '<p>a<iframe></iframe><video>v</video></p>',
    });

    assert.equal(dropped.text, 'av\n');

    assert.equal(
      dropped.summary,
      '1 line of Markdown. Dropped tags with text kept: iframe (1), video (1).',
    );
  });

  it('rejects deep input', () => {
    assert.throws(() => htmlToMarkdownTool.run({ fields: {}, text: '<div>'.repeat(101) }), {
      message: 'HTML conversion supports up to 100 nesting levels.',
      name: 'ToolError',
    });
  });
});
