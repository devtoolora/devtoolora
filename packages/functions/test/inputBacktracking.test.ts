import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseCubicBezier } from '@devtoolora/functions/css';
import { morseToText } from '@devtoolora/functions/encoding';
import { rejectOutOfRangeNumbers } from '@devtoolora/functions/format';
import { parsePageSelection } from '@devtoolora/functions/pdf';
import { markdownToc } from '@devtoolora/functions/text';
import { parseRobots, testRobots } from '@devtoolora/functions/web';

// Results pinned on the regexes these functions used before their linear rewrites, followed by
// inputs that made those regexes backtrack for seconds.

const outcome = (run: () => unknown): unknown => {
  try {
    return run();
  } catch (error) {
    return {
      error: (error as { code?: string }).code ?? String(error),
      message: (error as Error).message,
    };
  }
};

const long = (unit: string, length = 100_000): string =>
  unit.repeat(Math.ceil(length / unit.length));

async function assertQuick(run: () => unknown): Promise<void> {
  const start = performance.now();

  await run();

  // The old regexes took more than 5 seconds on these inputs; the rewrites take milliseconds.
  assert.ok(performance.now() - start < 500, `took ${Math.round(performance.now() - start)} ms`);
}

const robots = 'User-agent: *\nDisallow: /a#b\n';
const tocOptions = { bullet: '-', maxLevel: 6, minLevel: 1 } as const;

describe('input regexes', () => {
  it('keeps out-of-range number results', () => {
    const cases: Array<[string, unknown]> = [
      [
        '{"a":1e400}',
        {
          error: 'NON_FINITE_NUMBER',
          message:
            'A number such as 1e400 or 1e-400 is beyond the range of a double and would become null or 0; quote it as a string.',
        },
      ],
      ['{"a":"1e400"}', 'ok'],
      ['[1, -2.5e-3, "x\\"1e999"]', 'ok'],
      [
        '{"a":1e-400}',
        {
          error: 'NON_FINITE_NUMBER',
          message:
            'A number such as 1e400 or 1e-400 is beyond the range of a double and would become null or 0; quote it as a string.',
        },
      ],
      ['{"a":"\\\\"}', 'ok'],
      [
        '[1e308, 2e308]',
        {
          error: 'NON_FINITE_NUMBER',
          message:
            'A number such as 1e400 or 1e-400 is beyond the range of a double and would become null or 0; quote it as a string.',
        },
      ],
      [
        '{"k":"v"} 1e999',
        {
          error: 'NON_FINITE_NUMBER',
          message:
            'A number such as 1e400 or 1e-400 is beyond the range of a double and would become null or 0; quote it as a string.',
        },
      ],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => (rejectOutOfRangeNumbers(input), 'ok')),
        expected,
        input,
      );
  });

  it('keeps robots.txt results', () => {
    const cases: Array<[string, unknown]> = [
      [
        'User-agent: *\nDisallow: /a # c\nAllow: /b#x\n# full\nSitemap: https://x/s.xml',
        {
          groups: [
            {
              agents: ['*'],
              rules: [
                { allow: false, line: 2, pattern: '/a' },
                { allow: true, line: 3, pattern: '/b' },
              ],
            },
          ],
          sitemaps: ['https://x/s.xml'],
          warnings: [],
        },
      ],
      [
        'User-agent: *\r\nDisallow: /p\u2028q # r',
        {
          groups: [{ agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/p\u2028q' }] }],
          sitemaps: [],
          warnings: [],
        },
      ],
      [
        'User-agent: a#b\nDisallow: ##',
        { groups: [{ agents: ['a'], rules: [] }], sitemaps: [], warnings: [] },
      ],
      [
        'Disallow: /x\u2029# y # z',
        { groups: [], sitemaps: [], warnings: ['Line 1: rule before any User-agent group.'] },
      ],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => parseRobots(input)),
        expected,
        input,
      );
  });

  it('keeps robots path results', () => {
    const cases: Array<[string, unknown]> = [
      [
        '/a\n/a#b\n/b # c',
        {
          file: {
            groups: [{ agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] }],
            sitemaps: [],
            warnings: [],
          },
          results: [
            { allowed: false, path: '/a', rule: { allow: false, line: 2, pattern: '/a' } },
            { allowed: false, path: '/a', rule: { allow: false, line: 2, pattern: '/a' } },
            { allowed: true, path: '/b ' },
          ],
          group: { agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] },
        },
      ],
      [
        'https://x.io/a#frag',
        {
          file: {
            groups: [{ agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] }],
            sitemaps: [],
            warnings: [],
          },
          results: [{ allowed: false, path: '/a', rule: { allow: false, line: 2, pattern: '/a' } }],
          group: { agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] },
        },
      ],
      [
        '/x\u2028y#z',
        {
          file: {
            groups: [{ agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] }],
            sitemaps: [],
            warnings: [],
          },
          results: [{ allowed: true, path: '/x\u2028y' }],
          group: { agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] },
        },
      ],
      [
        '#only',
        {
          file: {
            groups: [{ agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] }],
            sitemaps: [],
            warnings: [],
          },
          results: [{ allowed: true, path: '/' }],
          group: { agents: ['*'], rules: [{ allow: false, line: 2, pattern: '/a' }] },
        },
      ],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => testRobots(robots, { agent: 'x', paths: input })),
        expected,
        input,
      );
  });

  it('keeps page selection results', () => {
    const cases: Array<[string, unknown]> = [
      ['1 - 3, 5', [1, 2, 3, 5]],
      ['1-3', [1, 2, 3]],
      [' 2 –4', [2, 3, 4]],
      ['last', [20]],
      [
        '1--2',
        {
          error: 'INVALID_PDF',
          message:
            '"1--2" has more than one dash. Use page numbers and ranges such as 1-3, 5, 8-, last, odd or even.',
        },
      ],
      ['- 3', [1, 2, 3]],
      ['1 -', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
      ['3-last', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
      ['1 2', [1, 2]],
      ['1,,2', [1, 2]],
      [
        '1 - 2 - 3',
        {
          error: 'INVALID_PDF',
          message:
            '"1-2-3" has more than one dash. Use page numbers and ranges such as 1-3, 5, 8-, last, odd or even.',
        },
      ],
      ['  1  - 2', [1, 2]],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => parsePageSelection(input, 20)),
        expected,
        input,
      );
  });

  it('keeps Morse results', () => {
    const cases: Array<[string, unknown]> = [
      ['.... . .-.. .-.. --- / .-- --- .-. .-.. -..', 'HELLO WORLD'],
      ['...   /   ---', 'S O'],
      [
        '... //',
        {
          error: 'UNKNOWN_MORSE_SEQUENCE',
          message: 'Morse input has an empty word: remove the extra / separator.',
        },
      ],
      [
        '/ ...',
        {
          error: 'UNKNOWN_MORSE_SEQUENCE',
          message: 'Morse input has an empty word: remove the extra / separator.',
        },
      ],
      ['.-\t/\t-...', 'A B'],
      [
        '... / ',
        {
          error: 'UNKNOWN_MORSE_SEQUENCE',
          message: 'Morse input has an empty word: remove the extra / separator.',
        },
      ],
      ['--  / ..', 'M I'],
      ['...', 'S'],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => morseToText(input)),
        expected,
        input,
      );
  });

  it('keeps cubic-bezier results', () => {
    const cases: Array<[string, unknown]> = [
      ['cubic-bezier(0.1, 0.7, 1, 0.1)', [0.1, 0.7, 1, 0.1]],
      ['ease', null],
      ['transition: all 1s cubic-bezier(.17,.67,.83,.67)', [0.17, 0.67, 0.83, 0.67]],
      ['cubic-bezier(var(--x), 1, 1, 1)', null],
      ['cubic-bezier(1,2,3', null],
      ['cubic-bezier((0,0,1,1)', null],
      ['cubic-bezier() cubic-bezier(0,0,1,1)', null],
      ['CUBIC-BEZIER(0,0,1,1)', null],
      ['cubic-bezier(0,0,1,1))', [0, 0, 1, 1]],
      ['cubic-bezier(2,0,1,1)', null],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => parseCubicBezier(input) ?? null),
        expected,
        input,
      );
  });

  it('keeps table of contents results', () => {
    const cases: Array<[string, unknown]> = [
      ['# a<br>b', '- [ab](#ab)'],
      ['# <a href="x">t</a>', '- [t](#t)'],
      ['# 1 < 2 > 0', '- [1 < 2 > 0](#1--2--0)'],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => markdownToc(input, tocOptions).text),
        expected,
        input,
      );
  });

  it('removes tags that removing a tag puts together', () => {
    assert.equal(markdownToc('# a <<b>b> c', tocOptions).text, '- [a  c](#a-b-c)');
  });

  it('stays linear on long separators, comments and strings', async () => {
    await assertQuick(() => outcome(() => rejectOutOfRangeNumbers(`"${long('\\"')}`)));
    await assertQuick(() => parseRobots(`#${long('#')}\u2028x`));

    await assertQuick(() =>
      testRobots(robots, { agent: 'x', paths: `#${long('#', 50_000)}\u2028x` }),
    );

    await assertQuick(() => outcome(() => parsePageSelection(`1${long(' ')}x`, 20)));
    await assertQuick(() => outcome(() => morseToText(`.${long(' ')}.`)));

    await assertQuick(() =>
      markdownToc(`# ${long('<', 50_000)}${long('b>', 100_000)}`, tocOptions),
    );

    await assertQuick(() => parseCubicBezier(`cubic-bezier(${long('cubic-bezier((')}`));
  });
});
