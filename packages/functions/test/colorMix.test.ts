import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatCssColor, mixColors, parseCssColor } from '@devtoolora/functions/color';

const mix = (a: string, b: string, weight: number, space: 'oklab' | 'oklch' | 'srgb') =>
  formatCssColor(mixColors(parseCssColor(a), parseCssColor(b), weight, space));

describe('color mix', () => {
  it('matches the reference vectors', () => {
    assert.equal(mix('#ff0000', '#0000ff', 0.5, 'srgb').hex, '#800080');
    assert.equal(mix('#000000', '#ffffff', 0.5, 'srgb').hex, '#808080');
    assert.equal(mix('#000000', '#ffffff', 0.5, 'oklab').hex, '#636363');
  });

  it('takes the shorter hue arc in oklch', () => {
    const hue = Number(mix('#ff0000', '#0000ff', 0.5, 'oklch').oklch.match(/ ([\d.]+)\)$/)?.[1]);

    assert.ok(Math.abs(hue - 326.6) <= 0.5);
  });

  it('returns an endpoint at weight 1 or 0', () => {
    for (const space of ['srgb', 'oklab', 'oklch'] as const) {
      assert.equal(mix('#2563eb', '#f97316', 1, space).hex, '#2563eb');
      assert.equal(mix('#2563eb', '#f97316', 0, space).hex, '#f97316');
    }
  });

  it('premultiplies alpha', () => {
    const result = mixColors(
      parseCssColor('rgb(255 0 0 / 0)'),
      parseCssColor('#0000ff'),
      0.5,
      'srgb',
    );

    assert.equal(formatCssColor(result).hex, '#0000ff80');
    assert.equal(result.alpha, 0.5);
  });

  it('mixes out-of-gamut inputs at their written value, as browsers do', () => {
    const [a, b] = ['oklch(60% 0.15 30)', 'oklch(60% 0.15 210)'];

    // Opposite hues at equal chroma cancel; Chromium computes oklab(0.6 0 0).
    assert.equal(mix(a, b, 0.5, 'oklab').hex, '#808080');

    // Chromium paints the sRGB mix as about rgb(60, 118, 124).
    const srgb = mixColors(parseCssColor(a), parseCssColor(b), 0.5, 'srgb');

    for (const [channel, expected] of [
      [srgb.r, 60],
      [srgb.g, 118],
      [srgb.b, 124],
    ] as const)
      assert.ok(Math.abs(channel * 255 - expected) <= 1, `${channel * 255} vs ${expected}`);
  });
});
