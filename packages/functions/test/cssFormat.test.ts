import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatCss } from '../src/format/cssFormat';

const format = (input: string) => formatCss(input, { indent: 2, mode: 'format' }).text;
const minify = (input: string) => formatCss(input, { indent: 2, mode: 'minify' }).text;

describe('formatCss', () => {
  it('puts one declaration per line', () => {
    assert.equal(
      format('a{color:red;margin:0 auto}'),
      'a {\n  color: red;\n  margin: 0 auto;\n}\n',
    );

    assert.equal(formatCss('a{b:c}b{c:d}', { indent: 2, mode: 'format' }).rules, 2);
  });

  it('nests at-rules and CSS nesting', () => {
    assert.equal(
      format('@media (min-width:600px){a{b:c}}'),
      '@media (min-width:600px) {\n  a {\n    b: c;\n  }\n}\n',
    );

    assert.equal(
      formatCss('.a{color:red;&:hover{color:blue}}', { indent: 4, mode: 'format' }).text,
      '.a {\n    color: red;\n    &:hover {\n        color: blue;\n    }\n}\n',
    );
  });

  it('keeps strings, url() and escapes intact', () => {
    assert.equal(format('a{content:"}{;/*"}'), 'a {\n  content: "}{;/*";\n}\n');
    assert.equal(format('a{background:url(x;y{}.png)}'), 'a {\n  background: url(x;y{}.png);\n}\n');
    assert.equal(minify('a{content:"\\"}"}'), 'a{content:"\\"}"}');
    assert.equal(minify('.a\\}b{color:red}'), '.a\\}b{color:red}');
  });

  it('minifies without value transforms', () => {
    assert.equal(
      minify('/* x */ a {\n  color: red;\n  margin: 0 auto;\n}\n'),
      'a{color:red;margin:0 auto}',
    );

    assert.equal(
      minify('/*! license */\na { color: #FFFFFF; top: 0px; }'),
      '/*! license */a{color:#FFFFFF;top:0px}',
    );

    assert.equal(minify('a b{}'), 'a b{}');

    assert.equal(
      minify('@media screen and (min-width:1px){a{b:c}}'),
      '@media screen and (min-width:1px){a{b:c}}',
    );
  });

  it('keeps custom property blocks as values', () => {
    assert.equal(minify('a{--x:{a};--y:b}'), 'a{--x:{a};--y:b}');
    assert.equal(format('a{--x:{a};--y:b}'), 'a {\n  --x: {a};\n  --y: b;\n}\n');
    assert.equal(formatCss('a{--x:{a};--y:b}', { indent: 2, mode: 'format' }).rules, 1);
    assert.throws(() => format('a{--x:{a'), { message: /Unclosed block.*line 1, column 7/ });
  });

  it('joins removed comments without changing meaning', () => {
    assert.equal(minify('a/**/b{}'), 'a/**/b{}');
    assert.equal(minify('a{margin:0/**/auto}'), 'a{margin:0/**/auto}');
    assert.equal(minify('a{x:1px/*c*/2px}'), 'a{x:1px/**/2px}');
    assert.equal(minify('a{margin:0 /*c*/ auto}'), 'a{margin:0 auto}');
  });

  it('reports errors with positions', () => {
    assert.throws(() => format('a{'), { message: /Unclosed block.*line 1, column 2/ });

    assert.throws(() => format('a{content:"x}'), {
      message: /Unterminated string.*line 1, column 11/,
    });

    assert.throws(() => format('a{}\n/* x'), { message: /Unterminated comment.*line 2, column 1/ });
    assert.throws(() => format('a}'), { message: /Unexpected }.*line 1, column 2/ });
    assert.throws(() => format('  '), { message: /CSS input is required/ });
  });

  it('limits nesting to 100 levels', () => {
    assert.doesNotThrow(() => format(`${'a{'.repeat(100)}${'}'.repeat(100)}`));

    assert.throws(() => format(`${'a{'.repeat(101)}${'}'.repeat(101)}`), {
      message: /100 nesting levels\./,
    });
  });
});
