import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatHtml, tokenizeHtml } from '@devtoolora/functions/format';

const format = (input: string) => formatHtml(input, { indent: 2, mode: 'format' });
const minify = (input: string) => formatHtml(input, { indent: 2, mode: 'minify' });

describe('html format', () => {
  it('indents block elements and keeps inline elements on their line', () => {
    assert.deepEqual(format('<div><p>Hi <b>there</b></p></div>'), {
      autoClosed: 0,
      text: '<div>\n  <p>Hi <b>there</b></p>\n</div>\n',
    });

    assert.equal(
      formatHtml('<div><p>a</p></div>', { indent: 'tab', mode: 'format' }).text,
      '<div>\n\t<p>a</p>\n</div>\n',
    );
  });

  it('copies pre content byte for byte in both modes', () => {
    assert.equal(format('<pre>  a\n   b</pre>').text, '<pre>  a\n   b</pre>\n');
    assert.equal(minify('<pre>  a\n   b</pre>').text, '<pre>  a\n   b</pre>');
  });

  it('copies script content byte for byte in both modes', () => {
    const script = '<script>if (a < b) { x("</div>"); }</script>';

    assert.equal(format(script).text, `${script}\n`);
    assert.equal(minify(script).text, script);
    assert.equal(minify('<SCRIPT>a</div>b</Script>').text, '<SCRIPT>a</div>b</Script>');
  });

  it('does not indent void elements as parents', () => {
    assert.equal(
      format('<div><br><img src=x><p>a</p></div>').text,
      '<div>\n  <br><img src=x>\n  <p>a</p>\n</div>\n',
    );
  });

  it('closes unclosed elements and counts them', () => {
    assert.deepEqual(format('<div><span>x</div>'), {
      autoClosed: 1,
      text: '<div><span>x</span></div>\n',
    });
  });

  it('minifies comments and whitespace between tags', () => {
    assert.equal(minify('<ul>\n  <li> a </li>\n  <!-- c -->\n</ul>').text, '<ul><li> a </li></ul>');

    assert.equal(
      minify('<div><!--[if IE]><p>x</p><![endif]--></div>').text,
      '<div><!--[if IE]><p>x</p><![endif]--></div>',
    );

    assert.equal(minify('<p><b>a</b> <i>b</i></p>').text, '<p><b>a</b> <i>b</i></p>');
  });

  it('handles uppercase tags and quoted > in attributes', () => {
    assert.equal(format('<DIV><P>a</P></DIV>').text, '<DIV>\n  <P>a</P>\n</DIV>\n');
    assert.equal(minify('<a title="a>b">x</a>').text, '<a title="a>b">x</a>');

    assert.deepEqual(tokenizeHtml('<a title="a>b">'), [
      { kind: 'start', name: 'a', selfClosing: false, text: '<a title="a>b">' },
    ]);
  });

  it('treats an unterminated comment or tag as text', () => {
    assert.deepEqual(tokenizeHtml('<p>a<!-- b'), [
      { kind: 'start', name: 'p', selfClosing: false, text: '<p>' },
      { kind: 'text', text: 'a<!-- b' },
    ]);

    assert.deepEqual(tokenizeHtml('<a href="x'), [{ kind: 'text', text: '<a href="x' }]);
    assert.equal(tokenizeHtml(`<!--${'-'.repeat(200_000)}`).length, 1);
  });

  it('closes implied end tags without counting them', () => {
    assert.deepEqual(format('<p>a<p>b'), { autoClosed: 0, text: '<p>a\n<p>b\n' });

    assert.deepEqual(format('<ul><li>a<li>b</ul>'), {
      autoClosed: 0,
      text: '<ul>\n  <li>a\n  <li>b\n</ul>\n',
    });

    assert.equal(format(`<ul>${'<li>x'.repeat(101)}</ul>`).autoClosed, 0);
  });

  it('closes an open head before body content', () => {
    assert.deepEqual(format('<html><head><title>T</title><body><p>x</p></body></html>'), {
      autoClosed: 0,
      text: '<html>\n  <head>\n    <title>T</title>\n  <body>\n    <p>x</p>\n  </body>\n</html>\n',
    });
  });

  it('keeps whitespace characters that HTML does not collapse', () => {
    const kept = ['\u00A0', '\u2003', '\u3000', '\uFEFF'];

    for (const character of kept) {
      const inside = `<p>a${character}b</p>`;
      const alone = `<td>${character}</td>`;

      assert.equal(format(inside).text, `${inside}\n`);
      assert.equal(minify(inside).text, inside);
      assert.equal(format(alone).text, `${alone}\n`);
      assert.equal(minify(alone).text, alone);
    }

    assert.equal(minify('<p>\uFEFFa</p>').text, '<p>\uFEFFa</p>');
    assert.equal(format('<p>a \u00A0\n b</p>').text, '<p>a \u00A0 b</p>\n');
    assert.equal(minify('<p>a\t\f\r\n b</p>').text, '<p>a b</p>');
  });

  it('keeps a comment on the line of what it touches', () => {
    const expected = (input: string) => assert.equal(format(input).text, `${input}\n`);

    expected('<p>a<!-- c -->b</p>');
    expected('<p>a<!-- c --></p>');
    expected('<p><!-- c -->b</p>');
    expected('<p>a<!-- b --><!-- c -->d</p>');
    expected('<p>a<!-- c --><b>d</b></p>');
    expected('<p>a <!-- c -->b</p>');
    expected('<foo>a<!-- c -->b</foo>');

    assert.equal(
      format('<div>a<!-- c --><p>b</p></div>').text,
      '<div>\n  a<!-- c -->\n  <p>b</p>\n</div>\n',
    );
  });

  it('keeps a comment apart from what whitespace or a block separates it from', () => {
    assert.equal(format('<p>a <!-- c --> b</p>').text, '<p>\n  a\n  <!-- c -->\n  b\n</p>\n');

    assert.equal(
      format('<div><!-- c --><p>x</p></div>').text,
      '<div>\n  <!-- c -->\n  <p>x</p>\n</div>\n',
    );

    assert.equal(format('<!-- a -->\n<span>b</span>').text, '<!-- a -->\n<span>b</span>\n');
  });

  it('enforces nesting and node limits', () => {
    assert.throws(() => format('<div>'.repeat(101)), { message: /100 nesting levels/ });
    assert.throws(() => format('<br>'.repeat(100_001)), { message: /100,000 nodes/ });
    assert.throws(() => format('  '), { message: /required/ });
  });

  it('treats Object.prototype names as ordinary unknown tags', () => {
    assert.doesNotThrow(() => format('<constructor><b>x</b></constructor>'));
    assert.equal(format('<div><constructor>x</div>').autoClosed, 1);
  });
});
