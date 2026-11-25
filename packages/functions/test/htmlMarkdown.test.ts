import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { htmlToMarkdown } from '../src/format';

const md = (html: string) => htmlToMarkdown(html).markdown;

describe('html to markdown', () => {
  it('converts the supported subset', () => {
    assert.equal(
      md('<h2>Title</h2><p>Some <strong>bold</strong>, <em>em</em> and <code>a`b</code>.</p>'),
      '## Title\n\nSome **bold**, *em* and ``a`b``.\n',
    );

    assert.equal(
      md('<p><a href="https://x.dev/a b" title="T">x</a> <img src="i.png" alt="I"></p>'),
      '[x](<https://x.dev/a b> "T") ![I](i.png)\n',
    );

    assert.equal(
      md('<ul><li>One</li><li>Two<ol start="3"><li>Three</li></ol></li></ul>'),
      '- One\n- Two\n\n  3. Three\n',
    );

    assert.equal(
      md('<pre><code class="language-ts">const a = `x`;\n</code></pre>'),
      '```ts\nconst a = `x`;\n```\n',
    );

    assert.equal(md('<pre>a\n```\nb</pre>'), '````\na\n```\nb\n````\n');
    assert.equal(md('<blockquote><p>a</p><p>b</p></blockquote>'), '> a\n>\n> b\n');

    assert.equal(
      md('<table><tr><th>k</th><th>v</th></tr><tr><td>a|b</td><td>1</td></tr></table>'),
      '| k | v |\n| --- | --- |\n| a\\|b | 1 |\n',
    );

    assert.equal(md('<p>a<br>b</p><hr><p><del>x</del></p>'), 'a\\\nb\n\n---\n\n~~x~~\n');
    assert.equal(md('<div><section><span>plain</span></section></div>'), 'plain\n');
  });

  it('escapes Markdown in text', () => {
    assert.equal(
      md('<p>2 * 3 _x_ [y] # no</p><p># heading-like</p><p>1. not a list</p>'),
      '2 \\* 3 \\_x\\_ \\[y\\] # no\n\n\\# heading-like\n\n1\\. not a list\n',
    );

    assert.equal(md('<p>a&nbsp;b</p>'), 'a\u00A0b\n');
    assert.equal(md('<p>~~old~~ price</p>'), '\\~\\~old\\~\\~ price\n');

    assert.equal(md('<p>~~~</p><p>after</p><h2>Next</h2>'), '\\~\\~\\~\n\nafter\n\n## Next\n');
  });

  it('reports unsupported elements and spans', () => {
    const result = htmlToMarkdown(
      '<p>a<iframe src="x"></iframe><video>v</video><span>s</span></p><table><tr><td colspan="2">c</td></tr></table><script>x</script>',
    );

    assert.match(result.markdown, /^avs\n/);

    assert.deepEqual(result.unsupported, [
      { count: 1, name: 'colspan' },
      { count: 1, name: 'iframe' },
      { count: 1, name: 'video' },
    ]);
  });

  it('keeps spaces across inline tags and nests blocks', () => {
    assert.equal(md('<p>a<span> b </span>c <b> d </b>e</p>'), 'a b c **d** e\n');
    assert.equal(md('<html><body><p>x</p></body></html>'), 'x\n');
    assert.equal(htmlToMarkdown('<html><body><p>x</p></body></html>').unsupported.length, 0);

    assert.equal(
      md('<blockquote><ul><li><p>a</p><pre>b</pre></li><li>- c<br>d</li></ul></blockquote>'),
      '> - a\n>\n>   ```\n>   b\n>   ```\n> - \\- c\\\n>   d\n',
    );

    assert.equal(md('<table><tr><td>a<br>b</td></tr></table>'), '| a<br>b |\n| --- |\n');

    assert.equal(
      md('<table><tr><td><pre><b>x</b> y</pre></td></tr></table><textarea><i>t</i></textarea>'),
      '| x y |\n| --- |\n\nt\n',
    );
  });

  it('only lets nested lists interrupt item text where Markdown allows it', () => {
    assert.equal(md('<ul><li>a<ol><li>b</li></ol></li></ul>'), '- a\n  1. b\n');
    assert.equal(md('<ul><li>a<ul><li></li><li>b</li></ul></li></ul>'), '- a\n\n  -\n  - b\n');
  });

  it('bounds the output size', () => {
    const html = `<table><tr>${'<td>'.repeat(10_000)}${'<tr><td>'.repeat(40_000)}</table>`;

    assert.throws(() => md(html), {
      message: 'The Markdown output is limited to 20,000,000 characters.',
    });
  });

  it('drops document metadata without reporting it', () => {
    assert.deepEqual(
      htmlToMarkdown(
        '<title>Demo</title><meta charset="utf-8"><link rel="x"><base href="/"><p>x</p>',
      ),
      {
        markdown: 'x\n',
        unsupported: [],
      },
    );
  });

  it('decodes named and numeric character references as browsers do', () => {
    assert.equal(
      md('<p>&eacute;&copy;&#65;&#x41;&#128;&#x1F600;</p>'),
      '\u00E9\u00A9AA\u20AC\u{1F600}\n',
    );

    assert.equal(md('<p>&#0;&#x110000;</p>'), '\uFFFD\uFFFD\n');
    assert.equal(md('<p>&lt;b&gt;</p>'), '\\<b\\>\n');
    assert.equal(md('<p>&amp;amp;</p>'), '\\&amp;\n');
    assert.equal(md('<pre>&lt;x&gt;&amp;&#65;</pre>'), '```\n<x>&A\n```\n');
    assert.equal(md('<a href="/x?a=1&amp;b=2&#65;">L</a>'), '[L](/x?a=1&b=2A)\n');
    assert.equal(md('<img src="a.png" alt="&eacute;&#65;">'), '![\u00E9A](a.png)\n');
  });
});
