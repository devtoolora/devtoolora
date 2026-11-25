import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { githubSlug, markdownToc } from '@devtoolora/functions/text';

const options = { bullet: '-', maxLevel: 3, minLevel: 2 } as const;

describe('githubSlug', () => {
  it('follows GitHub anchor rules', () => {
    assert.equal(githubSlug('Hello, World!'), 'hello-world');
    assert.equal(githubSlug("What's new?"), 'whats-new');
    assert.equal(githubSlug('C++ & Go'), 'c--go');
    assert.equal(githubSlug('\u00DCber  uns'), '\u00FCber--uns');
  });
});

describe('markdownToc', () => {
  it('nests headings, dedupes anchors and skips fences', () => {
    const md = '# Title\n## Intro\n### Setup\n## Intro\n```\n## not a heading\n```\nUsage\n-----';

    assert.equal(
      markdownToc(md, options).text,
      '- [Intro](#intro)\n  - [Setup](#setup)\n- [Intro](#intro-1)\n- [Usage](#usage)',
    );
  });

  it('numbers ordered lists', () => {
    assert.equal(
      markdownToc('## A\n### B', { ...options, bullet: 'ordered' }).text,
      '1. [A](#a)\n   1. [B](#b)',
    );
  });

  it('uses the plain text of links, html and closing hashes', () => {
    assert.equal(
      markdownToc('## [Docs](https://x.y) and `code` <br>', options).text,
      '- [Docs and `code`](#docs-and-code)',
    );

    assert.equal(markdownToc('## Closing ##\r\n', options).text, '- [Closing](#closing)');
    assert.equal(markdownToc('A\r\n---\r\n', options).headings, 1);
  });

  it('ignores indented code and longer fences', () => {
    assert.deepEqual(markdownToc('    ## indented code', options), { headings: 0, text: '' });
    assert.equal(markdownToc('````\n```\n## x\n````\n## y', options).text, '- [y](#y)');
  });

  it('rejects bad levels and oversized input, and stays linear', () => {
    assert.throws(() => markdownToc('', { ...options, maxLevel: 2, minLevel: 4 }), {
      message: /must not exceed/,
    });

    assert.throws(() => markdownToc('a'.repeat(1_000_001), options), { message: /1,000,000/ });

    const many = markdownToc('## Same\n'.repeat(10_000), options);

    assert.equal(many.headings, 10_000);
    assert.doesNotThrow(() => markdownToc('<'.repeat(900_000), options));
    assert.doesNotThrow(() => markdownToc('## ' + '['.repeat(300_000), options));
  });
});

describe('markdownToc edge cases', () => {
  it('escapes brackets and backslashes in labels', () => {
    assert.equal(
      markdownToc('## Use [x] flags', options).text,
      '- [Use \\[x\\] flags](#use-x-flags)',
    );
  });

  it('does not treat a rule after a list item as a setext heading', () => {
    assert.equal(markdownToc('- item\n---', options).headings, 0);
  });

  it('leaves YAML front matter out of the list', () => {
    assert.equal(
      markdownToc('---\ntitle: X\ndate: Y\n---\n\n## Real\n', options).text,
      '- [Real](#real)',
    );

    assert.equal(markdownToc('---\r\ntitle: X\r\n---\r\n## Real', options).text, '- [Real](#real)');
    assert.equal(markdownToc('---\n## Open\n', options).text, '- [Open](#open)');
  });

  it('makes anchors from the rendered heading text', () => {
    const anchorOf = (heading: string): string =>
      /\(#(.*)\)$/.exec(markdownToc(heading, options).text)?.[1] ?? '';

    assert.equal(anchorOf('## _Emph_ text'), 'emph-text');
    assert.equal(anchorOf('## __init__ method'), 'init-method');
    assert.equal(anchorOf('## *a* **b**'), 'a-b');
    assert.equal(anchorOf('## snake_case_name'), 'snake_case_name');
    assert.equal(anchorOf('## `__init__` call'), '__init__-call');
  });

  it('reads headings the way CommonMark does', () => {
    assert.equal(markdownToc('<!--\n## hidden\n-->\n## shown', options).text, '- [shown](#shown)');
    assert.equal(markdownToc('> q\n---', options).headings, 0);
    assert.equal(markdownToc('    code\n---', options).headings, 0);
    assert.equal(markdownToc('Foo\nBar\n---', options).text, '- [Foo Bar](#foo-bar)');
    assert.equal(markdownToc('## A \\#', options).text, '- [A \\#](#a-)');
    assert.equal(markdownToc('> ## Quoted', options).text, '- [Quoted](#quoted)');
  });

  it('never gives two headings the same anchor', () => {
    const anchors = (markdown: string): string[] =>
      [...markdownToc(markdown, options).text.matchAll(/\(#(.*)\)/g)].map(
        (match) => match[1] ?? '',
      );

    assert.deepEqual(anchors('## A 1\n## A\n## A'), ['a-1', 'a', 'a-2']);
    assert.deepEqual(anchors('## A\n## a\n## A-1'), ['a', 'a-1', 'a-1-1']);
    assert.deepEqual(anchors('## A\n## A\n## A'), ['a', 'a-1', 'a-2']);
  });

  it('reads a first line behind a byte order mark', () => {
    assert.equal(markdownToc('\uFEFF## First\n', options).text, '- [First](#first)');
    assert.equal(markdownToc('\uFEFF---\nt: x\n---\n## First', options).text, '- [First](#first)');
  });
});
