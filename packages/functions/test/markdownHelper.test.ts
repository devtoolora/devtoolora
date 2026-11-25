import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import MarkdownIt from 'markdown-it';
import { processMarkdown } from '@devtoolora/functions/text';
import { assertMarkdownInput, assertTokenBudget } from '../src/text/markdown';

describe('CommonMark-aware cleanup', () => {
  it('removes actual inline HTML without corrupting code, quoted attributes, autolinks or destinations', () => {
    const source =
      'Read <b title="a > b">this</b> and `<b>code</b>`.\n\n<https://example.test> [ref](<https://example.test/path>) and \\<b>escaped.\n';
    const result = processMarkdown(source);

    assert.equal(
      result.text,
      'Read this and `<b>code</b>`.\n\n<https://example.test> [ref](<https://example.test/path>) and \\<b>escaped.\n',
    );

    assert.equal(result.links, 2);
    assert.equal(result.removedHtml, 2);
  });

  it('removes complete HTML blocks and leaves literal indented and fenced code intact', () => {
    const source =
      '# Kept\n\n<script>\nalert("not executed");\n</script>\n\n<div>gone</div>\n\n```html\n<script>kept</script>\n\n\n<div>kept</div>\n```\n\n    <b>also kept</b>\n';
    const result = processMarkdown(source);

    assert.ok(!result.text.includes('alert('));
    assert.ok(!result.text.includes('gone'));
    assert.ok(result.text.includes('<script>kept</script>\n\n\n<div>kept</div>'));
    assert.ok(result.text.includes('    <b>also kept</b>'));
    assert.equal(result.codeBlocks, 2);
    assert.equal(result.removedHtml, 2);
  });

  it('counts parsed headings, references, images and prose instead of syntax inside code', () => {
    const result = processMarkdown(
      'Title\n=====\n\n## Second\n\n[ref][docs] and <https://example.test>.\n\n![alt](image.png)\n\n[docs]: https://example.test/docs\n\n```md\n# fake\n[fake](./fake)\n```\n',
    );

    assert.equal(result.headings, 2);
    assert.equal(result.links, 2);
    assert.equal(result.images, 1);
    assert.equal(result.codeBlocks, 1);
    assert.equal(processMarkdown('# Title\n\nHello **world**.\n\n`skip code`\n').words, 3);
    assert.equal(processMarkdown('[unknown][missing] [unsafe](javascript:alert(1))').links, 0);
  });

  it('preserves hard breaks, code, container blank lines and outer whitespace; normalizes line endings', () => {
    const source = '  # Title\r\n\r\n\r\nParagraph  \r\nnext\r\n\r\n- one\r\n\r\n\r\n- two\r\n';

    assert.equal(
      processMarkdown(source).text,
      '  # Title\n\nParagraph  \nnext\n\n- one\n\n\n- two\n',
    );

    const retained = 'A <em>word</em>.\n\n<div>\nkeep\n\n\n</div>\n';

    assert.equal(
      processMarkdown(retained, { collapseWhitespace: false, stripHtml: false }).text,
      retained,
    );

    assert.equal(
      processMarkdown('text\n\n\nnext', { collapseWhitespace: false }).text,
      'text\n\n\nnext',
    );

    assert.equal(processMarkdown('').text, '');
    assert.equal(processMarkdown(' \t').text, ' \t');
  });

  it('handles nested containers and rejects bounded or invalid input with explicit errors', () => {
    const result = processMarkdown(
      '> ## Quoted <b>heading</b>\n>\n> - **Text** <em>kept</em>\n\n1. Item <i>one</i>\n',
    );

    assert.ok(result.text.includes('> ## Quoted heading'));
    assert.ok(result.text.includes('> - **Text** kept'));
    assert.equal(result.headings, 1);
    assert.equal(processMarkdown('- a\n\t<b>next</b>\n').text, '- a\n\tnext\n');
    assert.equal(processMarkdown('1. a\n\t<b>next</b>\n').text, '1. a\n\tnext\n');
    assert.equal(processMarkdown('x'.repeat(100_000)).words, 1);
    assert.throws(() => processMarkdown('x'.repeat(100_001)), /100,000/);
    assert.throws(() => processMarkdown('\ud800'), /valid Unicode/);
    assert.throws(() => processMarkdown('\0'), /NUL/);
    assert.throws(() => processMarkdown('*word* '.repeat(3000)), /10,000/);
  });

  it('names the calling tool in the shared Markdown limits', () => {
    assert.doesNotThrow(() => assertMarkdownInput('x'.repeat(100_000), 'Markdown Linter'));

    assert.throws(
      () => assertMarkdownInput('x'.repeat(100_001), 'Markdown Linter'),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Markdown Linter supports at most 100,000 UTF-16 input units.',
    );

    assert.throws(
      () => processMarkdown('x'.repeat(100_001)),
      /Markdown Helper supports at most 100,000 UTF-16 input units\./,
    );

    assert.throws(
      () =>
        assertTokenBudget(
          new MarkdownIt('commonmark').parse('a\n\n'.repeat(5_000), {}),
          'Markdown Linter',
        ),
      /Markdown Linter supports at most 10,000 parsed tokens\./,
    );
  });

  it('strips HTML inside image alt text at its own position', () => {
    assert.equal(
      processMarkdown('Hello world ![<b>logo</b>](x.png)').text,
      'Hello world ![logo](x.png)',
    );

    assert.equal(processMarkdown('# Title ![<b>](x)').text, '# Title ![](x)');
    assert.equal(processMarkdown('![<b>](x)').text, '![](x)');
    assert.equal(processMarkdown('a ![b ![<i>c</i>](y)](x) <u>d</u>').text, 'a ![b ![c](y)](x) d');
    assert.equal(processMarkdown('[![<b>](x)](y) <u>d</u>').text, '[![](x)](y) d');
    assert.equal(processMarkdown('![x\n\nThe <b>end</b>').text, '![x\n\nThe end');
  });

  it('reads a first line behind a byte order mark', () => {
    const result = processMarkdown('\uFEFF# Title\n');

    assert.equal(result.headings, 1);
    assert.equal(result.text, '# Title\n');
  });

  it('collapses blank lines right after a block but keeps those inside it', () => {
    assert.equal(processMarkdown('```\nx\n```\n\n\n\nb').text, '```\nx\n```\n\nb');
    assert.equal(processMarkdown('- a\n\n\n\nb').text, '- a\n\nb');
    assert.equal(processMarkdown('> a\n\n\n\nb').text, '> a\n\nb');
    assert.equal(processMarkdown('    code\n\n\n\nb').text, '    code\n\nb');
    assert.equal(processMarkdown('- a\n\n\n\n- b').text, '- a\n\n\n\n- b');
    assert.equal(processMarkdown('```\nx\n\n\n\n').text, '```\nx\n\n\n\n');
    assert.equal(processMarkdown('- ```\n  x\n\n\n\n').text, '- ```\n  x\n\n\n\n');
  });
});
