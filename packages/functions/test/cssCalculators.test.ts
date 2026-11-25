import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { aspectRatio, convertCssUnit, fluidClamp, solveAspect } from '../src/css';

const clampBase = {
  maxSize: 32,
  maxViewport: 1280,
  minSize: 16,
  minViewport: 320,
  rootSize: 16,
  unit: 'rem' as const,
};

describe('fluidClamp', () => {
  it('builds the rem clamp and samples the five viewports', () => {
    const result = fluidClamp(clampBase);

    assert.equal(result.css, 'font-size: clamp(1rem, 0.6667rem + 1.6667vw, 2rem);');

    assert.deepEqual(
      result.samples.map((sample) => sample.viewport),
      [320, 768, 1024, 1280, 1440],
    );

    assert.deepEqual(
      result.samples.map((sample) => sample.size),
      [16, 23.4667, 27.7333, 32, 32],
    );

    assert.equal(result.zoomWarning, false);
  });

  it('prints px units and a negative intercept', () => {
    assert.equal(
      fluidClamp({ ...clampBase, unit: 'px' }).css,
      'font-size: clamp(16px, 10.6667px + 1.6667vw, 32px);',
    );

    assert.equal(
      fluidClamp({ ...clampBase, minSize: 8, minViewport: 800, unit: 'px' }).css,
      'font-size: clamp(8px, -32px + 5vw, 32px);',
    );

    assert.equal(
      fluidClamp({
        maxSize: 500,
        maxViewport: 3840,
        minSize: 1,
        minViewport: 200,
        rootSize: 64,
        unit: 'rem',
      }).css,
      'font-size: clamp(0.0156rem, -0.4128rem + 13.7088vw, 7.8125rem);',
    );

    assert.equal(
      fluidClamp({ ...clampBase, maxViewport: 640, unit: 'px' }).css,
      'font-size: clamp(16px, 5vw, 32px);',
    );
  });

  it('warns when the size ratio exceeds 2.5', () => {
    const result = fluidClamp({ ...clampBase, maxSize: 48, minSize: 14 });

    assert.equal(result.zoomWarning, true);
    assert.equal(result.ratio, 3.4286);
  });

  it('rejects reversed bounds with the spec messages', () => {
    assert.throws(
      () => fluidClamp({ ...clampBase, minSize: 32 }),
      /^FunctionError: Minimum size must be smaller than maximum size\.$/,
    );

    assert.throws(
      () => fluidClamp({ ...clampBase, minViewport: 1280 }),
      /^FunctionError: Minimum viewport must be smaller than maximum viewport\.$/,
    );
  });
});

describe('convertCssUnit', () => {
  it('lists the 13 other units for 24px', () => {
    const rows = convertCssUnit(24, 'px', {
      parentFontSize: 16,
      rootFontSize: 16,
      viewportHeight: 900,
      viewportWidth: 1440,
    });

    assert.deepEqual(
      rows.map((row) => `${row.value}${row.unit}`),
      [
        '1.5rem',
        '1.5em',
        '150%',
        '18pt',
        '1.5pc',
        '0.25in',
        '0.635cm',
        '6.35mm',
        '25.4Q',
        '1.6667vw',
        '2.6667vh',
        '2.6667vmin',
        '1.6667vmax',
      ],
    );
  });

  it('converts from em using the parent font size', () => {
    const rows = convertCssUnit(2, 'em', {
      parentFontSize: 20,
      rootFontSize: 16,
      viewportHeight: 900,
      viewportWidth: 1440,
    });

    assert.equal(rows.find((row) => row.unit === 'px')?.value, 40);
  });
});

describe('aspectRatio', () => {
  it('simplifies 1920x1080 and solves the height', () => {
    const result = aspectRatio(1920, 1080);

    assert.deepEqual(result.ratio, [16, 9]);
    assert.equal(result.decimal, 1.7778);
    assert.equal(result.paddingTop, 56.25);
    assert.equal(result.nearest.label, '16:9');
    assert.equal(result.css, 'aspect-ratio: 16 / 9;');
    assert.equal(solveAspect(result.ratio, { width: 1280 }), 720);
    assert.equal(solveAspect(result.ratio, { height: 720 }), 1280);
  });

  it('reports the deviation of 1366x768 from 16:9', () => {
    const result = aspectRatio(1366, 768);

    assert.deepEqual(result.ratio, [683, 384]);
    assert.equal(result.nearest.label, '16:9');
    assert.equal(result.nearest.deviation, 0.0488);
  });

  it('solves from raw sizes and survives extreme inputs', () => {
    assert.deepEqual(aspectRatio(1.005, 1).ratio, [1, 1]);
    assert.equal(solveAspect([1.005, 1], { width: 2.01 }), 2);
    assert.deepEqual(aspectRatio(1000000, 0.01).ratio, [100000000, 1]);
    assert.equal(aspectRatio(1000000, 0.01).paddingTop, 0);
  });

  it('scales decimals before the GCD', () => {
    assert.deepEqual(aspectRatio(0.01, 0.01).ratio, [1, 1]);
  });
});
