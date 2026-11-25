import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatPath, minifyPath, parsePathData, toAbsolute, toRelative } from '../src/svg';
import { formatNumber } from '../src/svg/pathFormat';

const fmt = (text: string) => formatPath(parsePathData(text), 3);

const message = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : '';
  }

  return '';
};

describe('parsePathData', () => {
  it('reads implicit repetition and lineto after moveto', () => {
    const segments = parsePathData('M0 0 1 1 2 2');

    assert.deepEqual(
      segments.map((s) => [s.letter, s.explicit]),
      [
        ['M', true],
        ['L', false],
        ['L', false],
      ],
    );
  });

  it('reads exponents and signs as separate numbers', () => {
    assert.deepEqual(parsePathData('M-1e-3-2E+2')[0]?.values, [-0.001, -200]);
  });

  it('reads compact arc flags', () => {
    const arc = parsePathData('M0 0a1 1 0 00 1 1')[1];

    assert.deepEqual(arc?.values, [1, 1, 0, 0, 0, 1, 1]);
  });

  it('reports the first invalid character', () => {
    assert.equal(
      message(() => parsePathData('M0 0 L1')),
      'Invalid path data at character 8: expected a number.',
    );

    assert.equal(
      message(() => parsePathData('M0 0 X1')),
      'Invalid path data at character 6: expected a command.',
    );

    assert.match(
      message(() => parsePathData('M0 0a1 1 0 2 0 1 1')),
      /at character 12: expected a flag/,
    );
  });

  it('enforces the limits at the boundary', () => {
    const chars = (n: number) => `M0 0${' '.repeat(n - 4)}`;

    assert.equal(parsePathData(chars(100_000)).length, 1);

    assert.equal(
      message(() => parsePathData(chars(100_001))),
      'Path data is longer than 100,000 characters.',
    );

    assert.equal(parsePathData(`M0 0${'z'.repeat(19_999)}`).length, 20_000);

    assert.equal(
      message(() => parsePathData(`M0 0${'z'.repeat(20_000)}`)),
      'Path has more than 20,000 segments.',
    );
  });

  it('stays linear on a pathological input', () => {
    const start = performance.now();

    message(() => parsePathData(`M${'0.0.0.'.repeat(16_666)}`));
    assert.ok(performance.now() - start < 100);
  });
});

describe('serialization', () => {
  it('converts between absolute and relative', () => {
    assert.equal(formatPath(toAbsolute(parsePathData('m0 0l10 10')), 3), 'M0 0\nL10 10');
    assert.equal(formatPath(toRelative(parsePathData('M0 0L10 10')), 3), 'm0 0\nl10 10');

    assert.equal(
      formatPath(toAbsolute(parsePathData('m1 1h2v3zl1 1')), 3),
      'M1 1\nH3\nV4\nZ\nL2 2',
    );

    assert.equal(
      formatPath(toRelative(parsePathData('M1 1H3V4ZL2 2')), 3),
      'm1 1\nh2\nv3\nz\nl1 1',
    );

    assert.equal(
      formatPath(toAbsolute(parsePathData('M1 1a2 2 0 0 1 3 4')), 3),
      'M1 1\nA2 2 0 0 1 4 5',
    );
  });

  it('formats one segment per line', () => {
    assert.equal(fmt('M0 0 1 1Z'), 'M0 0\nL1 1\nZ');
  });

  it('minifies separators and repeated letters', () => {
    assert.equal(minifyPath(parsePathData('M 0.50 0.50 L 1.00 0.00'), 3), 'M.5.5 1 0');
    assert.equal(minifyPath(parsePathData('M1 2'), 0), 'M1 2');
    assert.equal(minifyPath(parsePathData('M0 0 L1 -1 L2 2 M3 3 M4 4'), 3), 'M0 0 1-1 2 2M3 3M4 4');
  });

  it('round-trips minified output', () => {
    const source = 'M0.5 0.5a1 1 0 0 1 -1 1l.25-.5 .5.5z';
    const once = minifyPath(parsePathData(source), 3);

    assert.equal(fmt(once), fmt(source));
  });

  it('formats numbers', () => {
    assert.equal(formatNumber(-0.0001, 3, false), '0');
    assert.equal(formatNumber(1.5, 3, false), '1.5');
    assert.equal(formatNumber(0.5, 3, true), '.5');
    assert.equal(formatNumber(-0.5, 3, true), '-.5');
    assert.equal(formatNumber(1234.5678, 2, false), '1234.57');
  });
});

describe('separators and large numbers', () => {
  it('follows comma_wsp', () => {
    assert.equal(
      message(() => parsePathData('M0 0,,1 1')),
      'Invalid path data at character 6: expected a number.',
    );

    assert.equal(
      message(() => parsePathData('M,0 0')),
      'Invalid path data at character 2: expected a number.',
    );

    assert.equal(
      message(() => parsePathData('M0 0,')),
      'Invalid path data at character 6: expected a number.',
    );

    assert.equal(
      message(() => parsePathData('M0\v0')),
      'Invalid path data at character 3: expected a number.',
    );

    assert.equal(fmt('M0,0,1 1'), 'M0 0\nL1 1');
    assert.equal(fmt('M0 0 , 1 1'), 'M0 0\nL1 1');
  });

  it('never prints an exponent', () => {
    assert.equal(minifyPath(parsePathData('M1e21 0'), 3), 'M1000000000000000000000 0');
    assert.equal(minifyPath(parsePathData('M-1e21 0'), 3), 'M-1000000000000000000000 0');
    assert.ok(!minifyPath(parsePathData('L1e300 0'.replace('L', 'M')), 3).includes('e'));
  });
});
