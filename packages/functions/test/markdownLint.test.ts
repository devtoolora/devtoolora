import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatMarkdownLint, lintMarkdown, markdownLintRules } from '../src/text';

const run = (text: string, rules = markdownLintRules) => lintMarkdown(text, rules);
const positions = (text: string, rules = markdownLintRules): string[] =>
  run(text, rules).issues.map(({ column, line, rule }) => `${line}:${column} ${rule.slice(0, 5)}`);
const vector = '# Title\n\n### Skipped\ntext   \n\n\nend';

describe('lintMarkdown', () => {
  it('reports the spec vector', () => {
    assert.deepEqual(positions(vector), [
      '3:1 MD001',
      '3:1 MD022',
      '4:5 MD009',
      '6:1 MD012',
      '7:4 MD047',
    ]);

    assert.equal(formatMarkdownLint(run(vector)).summary, '5 issues from 5 rules in 7 lines.');

    assert.equal(
      formatMarkdownLint(run(vector)).report.split('\n')[0],
      '3:1 MD001/heading-increment Heading levels should only increment by one level at a time [Expected: h2; Actual: h3]',
    );
  });

  it('passes a clean document', () => {
    const output = formatMarkdownLint(run('# A\n\nText.\n'));

    assert.equal(output.summary, 'No issues from 10 rules.');
    assert.equal(output.report, 'No issues found.');
    assert.equal(run('').lines, 0);
  });

  it('handles CRLF and front matter', () => {
    assert.deepEqual(positions(vector.replaceAll('\n', '\r\n')), [
      '3:1 MD001',
      '3:1 MD022',
      '4:5 MD009',
      '6:1 MD012',
      '7:4 MD047',
    ]);

    assert.deepEqual(positions('---\r\ntitle: x\r\n---\r\n# A\r\n\r\ntext\r\n'), []);
    assert.deepEqual(positions('---\ntitle: x  \n\n\n---\n# A\n\ntext\n'), []);
  });

  it('checks MD004', () => {
    assert.deepEqual(positions('* a\n* b\n\n- c\n'), ['4:1 MD004']);
    assert.equal(run('* a\n* b\n').issues.length, 0);
    assert.equal(run('- a\n+ b\n').issues[0]?.detail, '[Expected: dash; Actual: plus]');
    assert.equal(run('* a\n- b\n').issues[0]?.detail, '[Expected: asterisk; Actual: dash]');
  });

  it('checks MD009', () => {
    assert.equal(run('a  \n').issues.length, 0);
    assert.equal(run('```js\na   \n```\n').issues.length, 0);
    assert.equal(run('a   \n').issues[0]?.detail, '[3 spaces]');
    assert.equal(run('a \n').issues[0]?.detail, '[1 space]');
  });

  it('checks MD010', () => {
    assert.deepEqual(positions('a\tb\n'), ['1:2 MD010']);
    assert.equal(run('a\tb\tc\n').issues[0]?.detail, '[2 tabs]');
    assert.equal(run('a\tb\n').issues[0]?.detail, '[1 tab]');
    assert.equal(run('use `a\tb` here\n').issues.length, 0);
    assert.equal(run('```js\na\tb\n```\n').issues.length, 0);
  });

  it('checks MD012', () => {
    assert.equal(run('```js\na\n\n\nb\n```\n').issues.length, 0);
    assert.equal(run('a\n\n\n\nb\n').issues[0]?.detail, '[3 blank lines]');
    assert.equal(run('a\n\nb\n').issues.length, 0);
  });

  it('checks MD022', () => {
    assert.equal(run('text\n# A\n\nb\n').issues[0]?.detail, '[Above]');
    assert.equal(run('# A\ntext\n').issues[0]?.detail, '[Below]');
    assert.equal(run('a\n\n# A\ntext\n\n## B\n').issues.length, 1);
    assert.equal(run('text\n# A\ntext\n').issues[0]?.detail, '[Above and below]');
    assert.equal(run('# A\n\ntext\n\n## B').issues.length, 1);

    assert.equal(
      run('> # A\n>\n> text\n').issues.filter((i) => i.rule === 'MD022/blanks-around-headings')
        .length,
      0,
    );
  });

  it('checks MD025', () => {
    assert.deepEqual(positions('# A\n\n# B\n'), ['3:1 MD025']);
    assert.equal(run('# A\n\n# B\n').issues[0]?.detail, '[First h1 on line 1]');
    assert.equal(run('# A\n\n## B\n').issues.length, 0);
    assert.equal(run('---\na: b\n---\n# A\n').issues.length, 0);
  });

  it('checks MD040', () => {
    assert.deepEqual(positions('```\nx\n```\n'), ['1:1 MD040']);
    assert.equal(run('```\nx\n```\n').issues[0]?.detail, '[No language]');
    assert.equal(run('~~~js\nx\n~~~\n').issues.length, 0);
  });

  it('checks MD047', () => {
    assert.equal(run('a\n\n').issues[0]?.detail, '[Extra blank lines at the end]');
    assert.equal(run('a').issues[0]?.detail, '[No final newline]');
    assert.equal(run('a\n').issues.length, 0);
  });

  it('accepts a fragment for every anchor of repeated headings', () => {
    assert.deepEqual(positions('# A 1\n\n## A\n\n## A\n\n[x](#a-2)\n'), []);
    assert.deepEqual(positions('# A\n\n## a\n\n## A-1\n\n[x](#a-1-1)\n'), []);
    assert.deepEqual(positions('# A 1\n\n## A\n\n## A\n\n[x](#a-3)\n'), ['7:1 MD051']);
  });

  it('accepts the fragments markdownlint always allows', () => {
    for (const fragment of ['top', 'L20', 'L19C5', 'L19C5-L21C11', 'L19-L21'])
      assert.deepEqual(positions(`# A\n\n[x](#${fragment})\n`), []);

    assert.deepEqual(positions('# A {#custom}\n\n[x](#custom)\n'), []);
    assert.deepEqual(positions('# A\n\n[x](#custom)\n'), ['3:1 MD051']);
    assert.deepEqual(positions('# A\n\n[x](#L20x)\n'), ['3:1 MD051']);
  });

  it('reads a first line behind a byte order mark', () => {
    assert.deepEqual(positions('\uFEFF# A\n\n### B\n'), ['3:1 MD001']);
    assert.deepEqual(positions('\uFEFF---\nt: x\n---\n\n# A\n'), []);
  });

  it('checks MD051', () => {
    assert.deepEqual(positions('# A\n\n[x](#Missing)\n'), ['3:1 MD051']);
    assert.equal(run('# A\n\n[x](#Missing)\n').issues[0]?.detail, '[#Missing]');
    assert.equal(run('# A ![logo](x.png)\n\n[l](#a-logo)\n').issues.length, 0);
    assert.equal(run('# constructor\n\n[c](#constructor)\n').issues.length, 0);

    assert.equal(
      run('# Same\n\n# Same\n\n[a](#same) [b](#same-1)\n', [markdownLintRules[9]!]).issues.length,
      0,
    );

    assert.equal(run('[a](#top)\n\n<a id="top"></a>\n').issues.length, 0);
    assert.equal(run('[a](#top)\n\n<div name="top"></div>\n').issues.length, 0);
    assert.equal(run('# `Code` Title\n\n[a](#code-title)\n').issues.length, 0);
  });

  it('only runs the chosen rules', () => {
    assert.deepEqual(positions(vector, [markdownLintRules[2]!]), ['4:5 MD009']);

    assert.equal(
      formatMarkdownLint(run('a\n', [markdownLintRules[2]!])).summary,
      'No issues from 1 rule.',
    );
  });

  it('names its limits', () => {
    assert.equal(run('a'.repeat(100_000)).issues.length, 1);

    assert.throws(
      () => run('a'.repeat(100_001)),
      /Markdown Linter supports at most 100,000 UTF-16 input units\./,
    );

    assert.throws(
      () => run('*a* '.repeat(2_600)),
      /Markdown Linter supports at most 10,000 parsed tokens\./,
    );

    const many = run('x\t\n'.repeat(1_001), [markdownLintRules[1]!, markdownLintRules[3]!]);
    const output = formatMarkdownLint(many);

    assert.equal(many.total, 1001);
    assert.equal(output.report.split('\n').length, 1001);
    assert.ok(output.report.endsWith('Showing 1,000 of 1,001 issues.'));
  });

  it('scans attributes in linear time', () => {
    const start = performance.now();

    run(`<div>\n${'id="'.repeat(24_000)}\n</div>\n`);
    assert.ok(performance.now() - start < 100);
  });
});
