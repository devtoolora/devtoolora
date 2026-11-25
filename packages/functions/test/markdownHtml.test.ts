import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  markdownToHtml,
  renderMarkdownHtml,
  type MarkdownPreviewNode,
} from '@devtoolora/functions/text';

function flatten(nodes: MarkdownPreviewNode[]): MarkdownPreviewNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

describe('structured Markdown to HTML', () => {
  it('renders headings, containers, references and literal code with actual parser semantics', () => {
    const source =
      'Title\n=====\n\n### Third\n\n- Outer\n  - Inner\n\n3. Third item\n4. Fourth item\n\n> **quoted** *text*\n\nRead [guide][docs] and `a < b`.\n\n[docs]: https://example.test/docs\n\n```html\n<img src=x>\n```\n\n    indented code\n';
    const result = renderMarkdownHtml(source);

    assert.equal(result.headings, 2);
    assert.equal(result.links, 1);
    assert.equal(result.codeBlocks, 2);
    assert.match(result.html, /<ol start="3">/);
    assert.match(result.html, /<a href="https:\/\/example.test\/docs">guide<\/a>/);
    assert.match(result.html, /<code class="language-html">&lt;img src=x&gt;\n<\/code>/);
    const nodes = flatten(result.nodes);

    assert.equal(nodes.filter((node) => node.tag === 'ul').length, 2);
    assert.equal(nodes.find((node) => node.tag === 'ol')?.start, 3);
    assert.equal(nodes.find((node) => node.tag === 'link')?.target, 'https://example.test/docs');
    assert.ok(nodes.some((node) => node.tag === 'code' && node.text === '<img src=x>\n'));
    assert.equal(markdownToHtml('# Hello'), '<h1>Hello</h1>\n');
  });

  it('makes table/strikethrough syntax and soft breaks explicit, with matching preview alignment', () => {
    const source = '| Left | Right |\n| :--- | ---: |\n| ~~old~~ | value |';
    const result = renderMarkdownHtml(source);

    assert.match(result.html, /<table>/);
    assert.match(result.html, /<s>old<\/s>/);
    const cells = flatten(result.nodes).filter((node) => node.tag === 'th');

    assert.deepEqual(
      cells.map((node) => node.align),
      ['left', 'right'],
    );

    assert.ok(!renderMarkdownHtml(source, { dialect: 'commonmark' }).html.includes('<table>'));
    assert.equal(renderMarkdownHtml('a\nb').html, '<p>a\nb</p>\n');
    assert.equal(renderMarkdownHtml('a\nb', { breaks: true }).html, '<p>a<br>\nb</p>\n');

    assert.equal(
      flatten(renderMarkdownHtml('a\nb', { breaks: true }).nodes).filter(
        (node) => node.tag === 'br',
      ).length,
      1,
    );

    assert.match(renderMarkdownHtml('a  \nb').html, /<br>/);
  });

  it('writes the same HTML5 void elements in CommonMark and Extended modes', () => {
    const source = 'a  \nb\n\n---\n\n![x](y.png)';
    const expected = '<p>a<br>\nb</p>\n<hr>\n<p><img src="y.png" alt="x"></p>\n';

    assert.equal(renderMarkdownHtml(source, { dialect: 'commonmark' }).html, expected);
    assert.equal(renderMarkdownHtml(source, { dialect: 'extended' }).html, expected);

    assert.equal(
      renderMarkdownHtml('a\nb', { breaks: true, dialect: 'commonmark' }).html,
      '<p>a<br>\nb</p>\n',
    );
  });

  it('escapes raw HTML, rejects dangerous URLs and keeps image URLs as passive preview data', () => {
    const result = renderMarkdownHtml(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) [bad](vbscript:evil)\n\n![A **diagram**](https://example.test/image.png)',
    );

    assert.ok(!/<script|<img src="x"|href="(?:javascript|vbscript):/.test(result.html));
    assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(result.html, /<img src="https:\/\/example.test\/image.png" alt="A diagram">/);
    assert.equal(result.images, 1);
    assert.equal(result.links, 0);
    const image = flatten(result.nodes).find((node) => node.tag === 'image');

    assert.equal(image?.text, 'A diagram');
    assert.equal(image?.target, 'https://example.test/image.png');

    assert.equal(
      flatten(renderMarkdownHtml('![data](data:image/png;base64,AA==)').nodes).find(
        (node) => node.tag === 'image',
      )?.target,
      'data:image/png;base64,AA==',
    );
  });

  it('handles empty input, Unicode, CRLF and bounded structures without silently truncating exports', () => {
    assert.deepEqual(renderMarkdownHtml(''), {
      codeBlocks: 0,
      headings: 0,
      html: '',
      images: 0,
      links: 0,
      nodes: [],
    });

    assert.equal(
      renderMarkdownHtml('# Příliš 😀\r\n\r\ntext\r\n').html,
      '<h1>Příliš 😀</h1>\n<p>text</p>\n',
    );

    assert.equal(renderMarkdownHtml('a'.repeat(100_000)).html.length, 100_008);
    assert.throws(() => renderMarkdownHtml('a'.repeat(100_001)), /100,000/);
    assert.throws(() => renderMarkdownHtml('*word* '.repeat(4000)), /10,000 parsed tokens/);
    assert.throws(() => renderMarkdownHtml('> '.repeat(80) + 'deep'), /nesting/);
    assert.throws(() => renderMarkdownHtml('\ud800'), /valid Unicode/);
    assert.throws(() => renderMarkdownHtml('\0'), /NUL/);
  });

  it('reads a first line behind a byte order mark', () => {
    assert.equal(markdownToHtml('\uFEFF# Title\n'), markdownToHtml('# Title\n'));
  });
});
