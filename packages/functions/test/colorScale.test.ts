import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  formatCssColor,
  generateColorScale,
  oklchToColor,
  parseCssColor,
  swatchStripSvg,
} from '@devtoolora/functions/color';
import { FunctionError } from '@devtoolora/functions/errors';

const lightnessOf = (hex: string) =>
  Number(formatCssColor(parseCssColor(hex)).oklch.match(/\(([\d.]+)%/)?.[1]);

describe('color scale', () => {
  it('anchors each input at its closest ladder step and keeps the input value', () => {
    for (const [hex, step] of [
      ['#2563eb', 700],
      ['#3b82f6', 600],
      ['#10b981', 500],
      ['#fde68a', 200],
      ['#1e1b4b', 950],
      ['#ffffff', 50],
    ] as const) {
      const scale = generateColorScale(parseCssColor(hex));

      assert.equal(scale.anchor, step, hex);
      assert.equal(scale.steps.find((entry) => entry.step === step)?.hex, hex);
      assert.equal(scale.steps.length, 11);
    }
  });

  it('keeps lightness strictly decreasing and every step inside sRGB', () => {
    for (const hex of ['#2563eb', '#fde68a', '#1e1b4b']) {
      const { steps } = generateColorScale(parseCssColor(hex));
      const lightness = steps.map((entry) => lightnessOf(entry.hex));

      lightness.forEach((value, index) => {
        if (index > 0) assert.ok(value < (lightness[index - 1] ?? 0), `${hex} step ${index}`);
      });

      for (const { color } of steps)
        for (const channel of [color.r, color.g, color.b]) assert.ok(channel >= 0 && channel <= 1);
    }
  });

  it('gives grays for an achromatic input and rejects alpha', () => {
    for (const { color } of generateColorScale(parseCssColor('#808080')).steps)
      assert.ok(Math.abs(color.r - color.g) < 1e-3 && Math.abs(color.g - color.b) < 1e-3);

    assert.throws(
      () => generateColorScale(parseCssColor('rgb(0 0 0 / 0.5)')),
      (error) => error instanceof FunctionError && error.code === 'COLOR_SCALE_ALPHA',
    );
  });

  it('maps out-of-gamut OKLCH and draws a swatch strip', () => {
    assert.equal(oklchToColor(0.7, 0.4, 150, 'oklch()').gamutMapped, true);
    assert.equal(oklchToColor(0.7, 0.05, 150, 'oklch()').gamutMapped, false);

    const svg = swatchStripSvg([
      { color: '#000000', detail: '#000000', label: '50', marked: true },
      { color: '#ffffff', label: '100' },
      { color: 'rgb(0 0 0 / 0.1)', label: 'faint' },
    ]);

    assert.match(svg, /^<svg [^>]*width="300"/);
    assert.match(svg, /font-weight="bold" fill="#ffffff">50<\/text>/);
    assert.match(svg, /text-anchor="end" [^>]*fill="#ffffff">#000000<\/text>/);
    assert.match(svg, /fill="#000000">100<\/text>/);
    assert.match(svg, /fill="#000000">faint<\/text>/);
  });
});
