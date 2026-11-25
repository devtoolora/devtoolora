import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  generateFlexboxCss,
  generateGridCss,
  generateShadowCss,
  parseShadowLayers,
  shadowColor,
  shadowColorWithOpacity,
} from '../src/css';

const grid = {
  alignContent: 'stretch',
  alignItems: 'stretch',
  autoFlow: 'row',
  columnGap: 16,
  columns: 3,
  justifyContent: 'stretch',
  justifyItems: 'stretch',
  minTrack: 120,
  rowGap: 16,
  rows: 2,
};
const flex = {
  align: 'center',
  alignContent: 'stretch',
  basis: 120,
  direction: 'row',
  gap: 16,
  grow: 0,
  justify: 'center',
  order: 0,
  shrink: 1,
  wrap: 'nowrap',
};

describe('CSS layout and shadow validation', () => {
  it('keeps explicit grid tracks and rejects silent fallbacks or flooring', () => {
    const css = generateGridCss({
      ...grid,
      autoFlow: 'column dense',
      columnGap: 96,
      minTrack: 600,
    });

    assert.match(css, /repeat\(3, minmax\(600px, 1fr\)\)/);
    assert.match(css, /repeat\(2, minmax\(80px, auto\)\)/);
    assert.match(css, /column-gap: 96px/);
    assert.match(css, /grid-auto-flow: column dense/);
    for (const invalid of [
      { columns: 1.5 },
      { minTrack: 601 },
      { rowGap: -1 },
      { autoFlow: 'nonsense' },
      { alignItems: 'invalid' },
    ])
      assert.throws(() => generateGridCss({ ...grid, ...invalid }));
  });

  it('supports reverse directions, fractional factors and a distinct featured selector', () => {
    const css = generateFlexboxCss({
      ...flex,
      direction: 'row-reverse',
      grow: 0.5,
      order: -12,
      shrink: 0.25,
      wrap: 'wrap-reverse',
    });

    assert.match(css, /flex-direction: row-reverse/);
    assert.match(css, /\.layout > \.item--featured/);
    assert.match(css, /flex: 0.5 0.25 120px/);
    assert.match(css, /order: -12/);
    for (const invalid of [
      { direction: 'bad' },
      { wrap: 'bad' },
      { basis: 1.5 },
      { grow: -1 },
      { grow: Infinity },
      { order: 13 },
    ])
      assert.throws(() => generateFlexboxCss({ ...flex, ...invalid }));
  });

  it('preserves alpha and validates hex/rgb channel bounds instead of accepting CSS-shaped garbage', () => {
    assert.deepEqual(shadowColor('rgba(15,23,42,0.18)'), { hex: '#0f172a', opacity: 0.18 });
    assert.deepEqual(shadowColor('#1234'), { hex: '#112233', opacity: 68 / 255 });
    assert.deepEqual(shadowColor('#2563eb80'), { hex: '#2563eb', opacity: 128 / 255 });
    assert.deepEqual(shadowColor('rgba(100%,0%,50%,25%)'), { hex: '#ff0080', opacity: 0.25 });
    assert.equal(shadowColorWithOpacity('#fff', 0), 'rgba(255, 255, 255, 0)');
    assert.equal(shadowColorWithOpacity('#112233', 0.18), 'rgba(17, 34, 51, 0.18)');
    for (const invalid of [
      '#12345',
      '#1234567',
      'rgba(0,0,0,2)',
      'rgb(256,0,0)',
      'rgb(101%,0%,0%)',
      'rgb(100%,0,0)',
      'rgba(0,50%,0,0.5)',
      'rgba(0,0,0,-1)',
      'rgba(0,0,0,)',
      'rgb(0 0 0)',
      'red;display:none',
      'url(x)',
    ])
      assert.throws(() => shadowColor(invalid));
    assert.throws(() => shadowColorWithOpacity('#fff', -1));
  });

  it('validates layer shape, dimensions, count and JSON limits with no partial shadow', () => {
    const first = { blur: 0, color: '#0000', inset: true, spread: 2, x: -200, y: 200 };
    const second = { blur: 300, color: 'rgba(0,0,0,0.18)', inset: false, spread: -200, x: 0, y: 0 };
    const layers = parseShadowLayers(JSON.stringify([first, second]));

    assert.deepEqual(layers, [first, second]);

    assert.match(
      generateShadowCss(layers),
      /inset -200px 200px 0px 2px #0000,\n    0px 0px 300px -200px rgba/,
    );

    for (const invalid of [
      '{}',
      '[]',
      '[null]',
      '[{}]',
      JSON.stringify([{ ...first, inset: 'false' }]),
      JSON.stringify([{ ...first, opacity: 0.5 }]),
      JSON.stringify(Array.from({ length: 6 }, () => first)),
      'x'.repeat(10001),
    ])
      assert.throws(() => parseShadowLayers(invalid));
    assert.throws(() => generateShadowCss([{ ...first, blur: -1 }]));
    assert.throws(() => parseShadowLayers(JSON.stringify([{ ...first, blur: -1 }])), /dimensions/);
  });
});
