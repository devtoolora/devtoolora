import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { svgBlob, svgWave } from '../src/svg';

const blobOptions = { fill: '#6366f1', points: 6, randomness: 50, seed: 42, size: 400 };
const waveOptions = {
  amplitude: 50,
  color: '#2563eb',
  height: 320,
  layers: 1,
  peaks: 4,
  position: 'bottom' as const,
  seed: 11,
  style: 'sine' as const,
  width: 1440,
};
const pairs = (svg: string, command: string) =>
  [...svg.matchAll(new RegExp(`${command}([^MCLZ"]*)`, 'g'))].map((m) =>
    (m[1] ?? '').trim().split(/[ ,]+/).map(Number),
  );
const allYs = (svg: string) =>
  [...svg.matchAll(/d="([^"]*)"/g)].flatMap((m) =>
    [...(m[1] ?? '').matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((p) => Number(p[2])),
  );

describe('svg blob', () => {
  it('keeps on-curve points on the circle without randomness', () => {
    const svg = svgBlob({ ...blobOptions, randomness: 0 });
    const onCurve = [...pairs(svg, 'M'), ...pairs(svg, 'C').map((c) => c.slice(-2))];

    assert.equal(onCurve.length, 7);

    onCurve.forEach(([x = 0, y = 0]) =>
      assert.ok(Math.abs(Math.hypot(x - 200, y - 200) - 180) < 0.01),
    );
  });

  it('prints the seed and stays inside the box', () => {
    assert.match(svgBlob(blobOptions), /^<svg[^>]*><!-- seed: 42 -->/);

    for (let seed = 1; seed <= 40; seed += 1) {
      const svg = svgBlob({ ...blobOptions, points: 3, randomness: 100, seed });

      allYs(svg).forEach((y) => assert.ok(y >= 0 && y <= 400));

      [...svg.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].forEach((m) =>
        assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 400),
      );
    }
  });

  it('is deterministic per seed and closed for 3 and 12 points', () => {
    assert.equal(svgBlob(blobOptions), svgBlob(blobOptions));
    assert.notEqual(svgBlob(blobOptions), svgBlob({ ...blobOptions, seed: 43 }));
    [3, 12].forEach((points) => assert.match(svgBlob({ ...blobOptions, points }), /Z"/));
  });
});

describe('svg wave', () => {
  it('spans the full width', () => {
    const svg = svgWave(waveOptions);
    const start = pairs(svg, 'M')[0] ?? [];
    const lastCurve = pairs(svg, 'C').at(-1) ?? [];

    assert.equal(start[0], 0);
    assert.equal(lastCurve.at(-2), 1440);
    assert.match(svg, /preserveAspectRatio="none"/);
  });

  it('mirrors the top position', () => {
    (['sine', 'smooth'] as const).forEach((style) => {
      const bottom = allYs(svgWave({ ...waveOptions, style }));
      const top = allYs(svgWave({ ...waveOptions, position: 'top', style }));

      assert.equal(top.length, bottom.length);
      top.forEach((y, i) => assert.ok(Math.abs(y - (320 - (bottom[i] ?? 0))) <= 0.011));
    });
  });

  it('prints the seed comment for smooth waves only', () => {
    assert.match(svgWave({ ...waveOptions, style: 'smooth' }), /^<svg[^>]*><!-- seed: 11 -->/);
    assert.ok(!svgWave(waveOptions).includes('seed'));
  });

  it('stays inside the box and fades layers', () => {
    ['sine', 'smooth'].forEach((style) => {
      const svg = svgWave({
        ...waveOptions,
        amplitude: 100,
        layers: 4,
        style: style as 'sine' | 'smooth',
      });

      allYs(svg).forEach((y) => assert.ok(y >= 0 && y <= 320));

      assert.deepEqual(
        [...svg.matchAll(/fill-opacity="([^"]+)"/g)].map((m) => m[1]),
        ['0.25', '0.5', '0.75', '1'],
      );

      assert.ok(!/\.\d{3}/.test(svg));
    });
  });
});
