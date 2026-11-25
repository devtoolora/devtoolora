import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { meshGradient, meshRadii } from '../src/css';

const colors = ['#f472b6', '#818cf8', '#38bdf8', '#facc15'];
const run = (seed: number, list = colors) =>
  meshGradient({ background: '#f8fafc', colors: list, seed });

describe('meshGradient', () => {
  it('is deterministic per seed and differs between seeds', () => {
    assert.equal(run(7).css, run(7).css);
    assert.notDeepEqual(run(7).points, run(8).points);
  });

  it('prints one radial layer per color in order', () => {
    const { css, points } = run(7);
    const layers = css.match(/radial-gradient\(at /g) ?? [];

    assert.equal(layers.length, 4);
    assert.ok(css.startsWith('.mesh {\n  background-color: #f8fafc;'));

    colors.forEach((color, index) =>
      assert.ok(
        css.includes(
          `radial-gradient(at ${points[index]?.x}% ${points[index]?.y}%, ` +
            `${color} 0px, transparent 50%)`,
        ),
      ),
    );

    assert.ok(
      points.every(
        ({ x, y }) =>
          Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100,
      ),
    );
  });

  it('builds an SVG with user-space radial gradients and elliptical radii', () => {
    const svg = run(7).svg;

    assert.equal(svg.match(/<radialGradient/g)?.length, 4);
    assert.equal(svg.match(/gradientUnits="userSpaceOnUse"/g)?.length, 4);
    assert.ok(svg.includes('offset="0.5"') && svg.includes('stop-opacity="0"'));
    assert.ok(svg.includes('<rect'));
  });

  it('uses root two times the farthest-side distance as radii', () => {
    assert.deepEqual(meshRadii({ x: 25, y: 50 }), { rx: 848.53, ry: 424.26 });
    assert.ok(run(7).svg.includes('scale('));
  });

  it('rejects unsafe colors', () => {
    assert.throws(() => run(7, ['red"><script>', 'blue']));
  });

  it('stops the transparent fade at min(50, round(200 / count))', () => {
    const five = ['#111111', '#222222', '#333333', '#444444', '#555555'];
    const six = [...five, '#666666'];
    const count = (css: string, text: string) => css.split(text).length - 1;

    assert.equal(count(run(42, five).css, 'transparent 40%'), 5);
    assert.equal(count(run(42, six).css, 'transparent 33%'), 6);
    assert.equal(count(run(42).css, 'transparent 50%'), 4);
    assert.ok(run(42, five).svg.includes('offset="0.4"'));
  });

  it('keeps points inside 0..100 for extreme seeds', () => {
    const low = run(1).points;
    const high = run(9999).points;

    assert.notDeepEqual(low, high);

    for (const { x, y } of [...low, ...high]) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
  });

  it('rejects bare hex, which browsers drop along with the whole declaration', () => {
    assert.throws(() => run(7, ['f472b6', '#818cf8', '#38bdf8']), /needs its #/);
    assert.throws(() => meshGradient({ background: 'f8fafc', colors, seed: 7 }), /needs its #/);
  });
});
