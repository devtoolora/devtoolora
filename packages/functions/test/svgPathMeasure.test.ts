import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatPath, measurePath, parsePathData, scalePath, translatePath } from '../src/svg';
import { arcToCubics } from '../src/svg/pathTransform';

const parse = parsePathData;
const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);

describe('translatePath', () => {
  it('moves absolute segments', () => {
    assert.equal(formatPath(translatePath(parse('M0 0L10 10'), 5, 5), 3), 'M5 5\nL15 15');
  });

  it('moves only the leading relative m', () => {
    assert.equal(formatPath(translatePath(parse('m1 1l2 2'), 5, 5), 3), 'm6 6\nl2 2');
  });
});

describe('scalePath', () => {
  it('scales arc radii uniformly', () => {
    const { notes, segments } = scalePath(parse('M0 0A5 5 0 0 1 10 0'), 2, 2);

    assert.deepEqual(notes, []);
    assert.deepEqual(segments[1]?.values, [10, 10, 0, 0, 1, 20, 0]);
  });

  it('flips sweep on mirroring', () => {
    const { segments } = scalePath(parse('M0 0A5 5 30 0 1 10 0'), -1, 1);

    assert.deepEqual(segments[1]?.values, [5, 5, -30, 0, 0, -10, 0]);
  });

  it('converts arcs to cubics when not uniform', () => {
    const { notes, segments } = scalePath(parse('M0 0A5 5 0 0 1 10 0'), 2, 1);
    const last = segments[segments.length - 1]?.values ?? [];

    assert.equal(notes.length, 1);
    assert.ok(segments.slice(1).every((segment) => segment.letter === 'C'));
    near(last[4] ?? NaN, 20, 1e-9);
    near(last[5] ?? NaN, 0, 1e-9);
  });

  it('keeps H and V and rejects bad scales', () => {
    assert.equal(formatPath(scalePath(parse('M0 0H5V5'), 2, 3).segments, 3), 'M0 0\nH10\nV15');
    assert.throws(() => scalePath(parse('M0 0'), 0, 1), /Scale must be between 0.001 and 1,000/);
  });
});

describe('arcToCubics', () => {
  it('skips identical endpoints and degenerate radii', () => {
    assert.deepEqual(arcToCubics(1, 1, [5, 5, 0, 0, 1, 1, 1]), []);
    assert.equal(arcToCubics(0, 0, [0, 5, 0, 0, 1, 3, 3]).length, 1);
  });
});

describe('measurePath', () => {
  it('computes exact cubic bbox', () => {
    assert.deepEqual(measurePath(parse('M0 0C0 10 10 10 10 0')).bbox, {
      height: 7.5,
      width: 10,
      x: 0,
      y: 0,
    });
  });

  it('computes a half circle bbox', () => {
    near(measurePath(parse('M0 0A5 5 0 0 1 10 0')).bbox.height, 5, 2e-3);
  });

  it('computes lengths', () => {
    near(measurePath(parse('M0 0L3 4')).length, 5, 1e-12);
    near(measurePath(parse('M10 0A10 10 0 0 1 0 10')).length, 15.708, 0.01);
  });

  it('counts', () => {
    const m = measurePath(parse('M0 0 1 1 2 2Z'));

    assert.deepEqual([m.commands, m.segments, m.subpaths], [2, 4, 1]);
  });

  it('lists points with anchors', () => {
    const { points } = measurePath(parse('M0 0C1 1 2 2 3 3'));
    const controls = points.filter((point) => point.kind === 'control');

    assert.deepEqual(
      controls.map((point) => point.anchor),
      [
        { x: 0, y: 0 },
        { x: 3, y: 3 },
      ],
    );
  });

  it('reflects S controls and handles Z with relative segments', () => {
    near(measurePath(parse('M0 0C0 10 10 10 10 0S20 -10 20 0')).bbox.height, 15, 1e-9);
    near(measurePath(parse('m0 0l3 0l0 4z')).length, 12, 1e-12);
  });
});

describe('fix round 1', () => {
  it('keeps S after an arc exact under non-uniform scale', () => {
    const path = 'M0 0A5 5 0 0 1 10 0S20 10 20 0';
    const scaled = measurePath(scalePath(parse(path), 2, 1).segments).bbox;
    const reference = measurePath(parse('M0 0A5 5 0 0 1 10 0C10 0 20 10 20 0')).bbox;

    near(scaled.height, reference.height, 1e-9);
    near(scaled.width, reference.width * 2, 1e-9);
  });

  it('rejects overflowing transforms', () => {
    assert.throws(() => scalePath(parse('M1e306 0L0 0'), 1000, 1000), /must stay finite/);
    assert.throws(() => translatePath(parse('M1e308 0'), 1e308, 0), /must stay finite/);
  });

  it('measures arc length on the true ellipse', () => {
    const [a, b] = [1000, 500];
    const h = ((a - b) / (a + b)) ** 2;
    const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

    near(measurePath(parse('M0 0A1000 500 0 0 1 2000 0')).length, perimeter / 2, 0.01);
  });

  it('keeps arc extremes that fall on a split between its cubic pieces', () => {
    const circle = measurePath(parse('M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z')).bbox;

    assert.deepEqual([circle.x, circle.y, circle.width, circle.height], [2, 2, 20, 20]);

    const half = measurePath(parse('M0 0A5 5 0 0 0 10 0')).bbox;

    assert.deepEqual([half.x, half.y, half.width, half.height], [0, 0, 10, 5]);
  });

  it('bounds the work on huge coordinates', () => {
    const text = `M0 0${'C1e15 1e15 -1e15 1e15 0 0'.repeat(1000)}`;
    const begin = Date.now();

    measurePath(parse(text));
    assert.ok(Date.now() - begin < 5000);
  });
});
