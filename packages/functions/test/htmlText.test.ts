import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { htmlToText } from '../src/format';

const text = (html: string, links: 'text' | 'inline' = 'text') => htmlToText(html, { links }).text;

describe('html to text', () => {
  it('keeps structure', () => {
    assert.equal(
      text(
        '<h1>Title</h1><p>Hello <b>big</b>\n  world&nbsp;!</p><ul><li>One<li>Two<ul><li>Deep</li></ul></ul><p>A<br>B</p>',
      ),
      'Title\n\nHello big world\u00A0!\n\n- One\n- Two\n  - Deep\n\nA\nB\n',
    );

    assert.equal(text('<ol start="3"><li>a</li><li>b</li></ol>'), '3. a\n4. b\n');

    assert.equal(
      text('<table><tr><th>k</th><th>v</th></tr><tr><td>a</td><td>1</td></tr></table>'),
      'k\tv\na\t1\n',
    );

    assert.equal(
      text(
        '<table><tr><th>Name</th><th>Role</th></tr><tr><td><p>Ada</p></td><td><p>Eng</p></td></tr></table>',
      ),
      'Name\tRole\nAda\tEng\n',
    );

    assert.equal(
      text('<table><tr><td><div>a</div><div>b</div></td><td>c</td></tr></table>'),
      'a b\tc\n',
    );

    assert.equal(text('<table><tr><td>a<br>b</td><td>c</td></tr></table>'), 'a b\tc\n');

    assert.equal(text('<p>a</p><hr><div>b</div><div>c</div>'), 'a\n\n---\n\nb\nc\n');
    assert.equal(text('<p>a<span> b </span>c</p>'), 'a b c\n');
    assert.equal(text('<p>a\r\nb</p>'), 'a b\n');
    assert.equal(text('<p><img src="a.png" alt="Logo"> text</p>'), 'Logo text\n');
  });

  it('drops hidden content and keeps pre', () => {
    assert.equal(
      text(
        '<head><title>T</title><style>p{}</style></head><body><script>x()</script><p>Body</p><!-- c --><svg><text>s</text></svg></body>',
      ),
      'Body\n',
    );

    assert.equal(text('<head><title>T</title><body><p>x</p>'), 'x\n');

    assert.equal(
      text('<html><head><meta charset="utf-8"><title>T</title><body><p>Hello</p></body></html>'),
      'Hello\n',
    );

    assert.equal(text('<pre>\n  a <b>b</b>\n    c &lt;</pre>'), '  a b\n    c <\n');
  });

  it('writes links as text or inline', () => {
    const html =
      '<p>See <a href="https://x.dev">docs</a>, <a href="#top">top</a> and <a href="https://y.dev">https://y.dev</a>.</p>';

    assert.equal(text(html), 'See docs, top and https://y.dev.\n');
    assert.equal(text(html, 'inline'), 'See docs (https://x.dev), top and https://y.dev.\n');
    assert.equal(htmlToText(html, { links: 'text' }).links, 3);
  });

  it('shares the formatter limits', () => {
    assert.throws(() => text('<div>'.repeat(101)), {
      message: 'HTML conversion supports up to 100 nesting levels.',
    });
  });

  it('drops document metadata even without an explicit head', () => {
    assert.equal(text('<!DOCTYPE html><title>Demo</title><p>x</p>'), 'x\n');
    assert.equal(text('<meta charset="utf-8"><link rel="x"><base href="/"><p>x</p>'), 'x\n');
  });

  it('numbers ordered lists as a browser does', () => {
    assert.equal(text('<ol><li value="5">a</li><li>b</li></ol>'), '5. a\n6. b\n');
    assert.equal(text('<ol reversed><li>a</li><li>b</li></ol>'), '2. a\n1. b\n');
    assert.equal(text('<ol reversed start="9"><li>a</li><li>b</li></ol>'), '9. a\n8. b\n');
    assert.equal(text('<ol reversed><li value="7">a</li><li>b</li></ol>'), '7. a\n6. b\n');
    assert.equal(text('<ol start="3"><li>a</li><li value="x">b</li></ol>'), '3. a\n4. b\n');
    assert.equal(text('<ul><li value="5">a</li></ul>'), '- a\n');
  });

  it('decodes named and numeric character references as browsers do', () => {
    const cases: Array<[string, string]> = [
      ['&amp;', '&'],
      ['&lt;b&gt;', '<b>'],
      ['&eacute;&copy;', '\u00E9\u00A9'],
      ['&copy', '\u00A9'],
      ['&notit;', '\u00ACit;'],
      ['&notin;', '\u2209'],
      ['&NotEqualTilde;', '\u2242\u0338'],
      ['&#65;&#x41;&#X41;&#65', 'AAAA'],
      ['&#128;', '\u20AC'],
      ['&#x1F600;', '\u{1F600}'],
      ['&#0;&#xD800;&#x110000;', '\uFFFD\uFFFD\uFFFD'],
      ['&bogus;&#;', '&bogus;&#;'],
      ['&amp;amp;', '&amp;'],
    ];

    for (const [source, decoded] of cases) assert.equal(text(`<p>${source}</p>`), `${decoded}\n`);

    const link = (href: string) => htmlToText(`<a href="${href}">L</a>`, { links: 'inline' }).text;

    assert.equal(link('/x?a=1&amp;b=2&#65;'), 'L (/x?a=1&b=2A)\n');
    assert.equal(link('/x?a=1&copy=2'), 'L (/x?a=1&copy=2)\n');
  });
});
