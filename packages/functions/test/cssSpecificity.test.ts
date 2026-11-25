import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { selectorSpecificity, specificityLimits } from '../src/css';

const one = (selector: string) => {
  const rows = selectorSpecificity(selector);

  assert.equal(rows.length, 1, selector);

  return rows[0]!;
};

describe('selectorSpecificity', () => {
  it('matches the spec vector table', () => {
    for (const [selector, expected] of [
      ['#nav .item > a:hover', [1, 2, 1]],
      [':where(#a) .b', [0, 1, 0]],
      [':is(#a, .b) span', [1, 0, 1]],
      ['a::before', [0, 0, 2]],
      ['a:before', [0, 0, 2]],
      ['li:nth-child(2n+1 of .important)', [0, 2, 1]],
      [':not(.a, #b)', [1, 0, 0]],
      ['*', [0, 0, 0]],
      [':host(.dark) p', [0, 2, 1]],
      ['::slotted(span)', [0, 0, 2]],
      ['::part(label)', [0, 0, 1]],
      [':has(> img)', [0, 0, 1]],
      ['input:not([type="checkbox"])', [0, 1, 1]],
    ] as const)
      assert.deepEqual(one(selector), { selector, specificity: expected }, selector);

    assert.deepEqual(selectorSpecificity('[data-x="a,b"], .c'), [
      { selector: '[data-x="a,b"]', specificity: [0, 1, 0] },
      { selector: '.c', specificity: [0, 1, 0] },
    ]);
  });

  it('handles escapes, case, namespaces and the remaining Selectors 4 rules', () => {
    for (const [selector, expected] of [
      ['#\\31 23', [1, 0, 0]],
      ['.a\\:b', [0, 1, 0]],
      ['A:HOVER::BEFORE', [0, 1, 2]],
      ['a:First-Letter', [0, 0, 2]],
      [':host', [0, 1, 0]],
      ['svg|rect, *|*', [0, 0, 1]],
      ['[lang|="en" i]', [0, 1, 0]],
      [':nth-last-child(odd of li.x, #y)', [1, 1, 0]],
      [':is(.a, ::before, #b)', [1, 0, 0]],
      [':is(1x, 2y) a', [0, 0, 1]],
      ['div/* , */.a', [0, 1, 1]],
      ['.a\\@b', [0, 1, 0]],
      [':where(:is(#a))', [0, 0, 0]],
      [':is([title=")"], #a)', [1, 0, 0]],
      ['*|*', [0, 0, 0]],
      [':WHERE(#a)', [0, 0, 0]],
      [':NOT(#a)', [1, 0, 0]],
      ['::-webkit-scrollbar', [0, 0, 1]],
      ['::part(label)::before', [0, 0, 2]],
      ['li::after::marker', [0, 0, 3]],
      ['::-webkit-scrollbar-button:vertical:decrement', [0, 2, 1]],
      [':active-view-transition-type(forwards, slide)', [0, 1, 0]],
      [':active-view-transition', [0, 1, 0]],
      ['.carousel::column::scroll-marker', [0, 1, 2]],
      ['::search-text', [0, 0, 1]],
      [':xr-overlay, :heading, :unchecked, :interest-source', [0, 1, 0]],
      ['td:nth-col(2n+1)', [0, 1, 1]],
      ['a\\', [0, 0, 1]],
      ['li:nth-child(2n/**/+1)', [0, 1, 1]],
      [':-webkit-any(#a)', [0, 1, 0]],
    ] as const)
      assert.deepEqual(selectorSpecificity(selector)[0]?.specificity, expected, selector);
  });

  it('splits on top-level commas and newlines only and skips blank lines', () => {
    assert.deepEqual(
      selectorSpecificity('a,\n\n  b\n:is(.x,\n.y)').map((row) => row.selector),
      ['a', 'b', ':is(.x,\n.y)'],
    );

    assert.deepEqual(selectorSpecificity(' \n\n '), []);

    assert.deepEqual(selectorSpecificity(Array(201).fill('/* c */').join('\n')), []);

    assert.deepEqual(
      selectorSpecificity('a , , b').map((row) => row.selector),
      ['a', 'b'],
    );
  });

  it('reports nesting and broken selectors as rows', () => {
    assert.deepEqual(one('.a &'), {
      error: '& depends on the parent rule; paste the resolved selector.',
      selector: '.a &',
    });

    const rows = selectorSpecificity('div[\n.ok');

    assert.ok(rows[0]?.error, 'div[ is an error row');
    assert.equal(rows[0]?.selector, 'div[');
    assert.deepEqual(rows[1], { selector: '.ok', specificity: [0, 1, 0] });

    for (const selector of [
      '#123',
      'a >',
      'a > > b',
      ':not()',
      ':has(:has(a))',
      ':is(a',
      'a::before.b',
      '::before::after',
      'a::before::after',
      '::part()',
      'a::before b',
      'a:before b',
      'a::before > b',
      'a::before b.c d::after e',
      '::slotted(a) b',
    ])
      assert.ok(one(selector).error, selector);

    for (const [selector, error] of [
      [':hovr', 'Unknown pseudo-class ":hovr".'],
      [':not(:hovr)', 'Unknown pseudo-class ":hovr".'],
      [':foo(#a #b)', 'Unknown pseudo-class ":foo()".'],
      ['a::befor', 'Unknown pseudo-element "::befor".'],
      ['#-', '"#-" is not a valid id selector.'],
      ['#1a', '"#1a" is not a valid id selector; escape a leading digit, e.g. #\\31 23.'],
      [':nth-child()', 'Expected an An+B value such as 2n+1, odd or even.'],
      ['::-webkit-', 'Unknown pseudo-element "::-webkit-".'],
      [':-webkit-', 'Unknown pseudo-class ":-webkit-".'],
      [':nth-last-col(foo)', '"foo" is not a valid An+B value such as 2n+1, odd or even.'],
      [':nth-col(2n of .a)', 'Only :nth-child() and :nth-last-child() accept "of S".'],
      [
        ':active-view-transition-type()',
        ':active-view-transition-type() needs a comma-separated list of names.',
      ],
      [
        ':active-view-transition-type(a,)',
        ':active-view-transition-type() needs a comma-separated list of names.',
      ],
    ])
      assert.equal(one(selector!).error, error, selector);
  });

  it('still scores a pseudo-element at the end of the selector', () => {
    assert.deepEqual(one('a b::before').specificity, [0, 0, 3]);
    assert.deepEqual(one('a::before:hover').specificity, [0, 1, 2]);
  });

  it('bounds nesting depth without throwing', () => {
    const nest = (levels: number) => `${':is('.repeat(levels)}a${')'.repeat(levels)}`;

    assert.deepEqual(one(nest(specificityLimits.maxDepth)).specificity, [0, 0, 1]);
    assert.match(one(nest(specificityLimits.maxDepth + 1)).error ?? '', /32 levels/);
    assert.match(one(`a${'x'.repeat(2000)}`).error ?? '', /2,000 characters/);
  });

  it('throws limit errors for oversized input', () => {
    assert.throws(() => selectorSpecificity(Array(201).fill('a').join(',')), /200 selectors/);
    assert.throws(() => selectorSpecificity('a'.repeat(100_001)), /100,000 characters/);
  });
});
