import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  apcaContrast,
  contrastRatio,
  generatePalette,
  hexToRgb,
  hslToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
} from '@devtoolora/functions/color';
import { FunctionError } from '@devtoolora/functions/errors';

describe('color functions', () => {
  it('parses and converts HEX, RGB, and HSL values', () => {
    assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204 });
    assert.deepEqual(parseColor('rgb(37, 99, 235)'), { r: 37, g: 99, b: 235 });
    assert.deepEqual(parseColor('hsl(217, 83%, 53%)'), { r: 36, g: 112, b: 235 });
    assert.deepEqual(parseColor('rgb( 37 , 99 ,235 )'), { r: 37, g: 99, b: 235 });
    assert.deepEqual(parseColor('hsl(217 , 83% , 53%)'), { r: 36, g: 112, b: 235 });
    assert.equal(rgbToHex(hexToRgb('#2563eb')), '#2563eb');

    const hsl = rgbToHsl({ r: 37, g: 99, b: 235 });

    assert.deepEqual(
      { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) },
      { h: 221, s: 83, l: 53 },
    );

    assert.deepEqual(hslToRgb({ h: 221, s: 83, l: 53 }), { r: 36, g: 99, b: 235 });
  });

  it('generates stable palettes and WCAG contrast values', () => {
    const blue = hexToRgb('#2563eb');
    const palette = generatePalette(blue, 'complementary');

    assert.equal(palette[0]!.base, '#2563eb');
    assert.equal(palette[0]!.shades[500], '#2563eb');
    assert.equal(Math.round(rgbToHsl(hexToRgb(palette[1]!.base)).h), 41);
    assert.equal(Math.round(contrastRatio(blue, { r: 255, g: 255, b: 255 }) * 100) / 100, 5.17);
  });

  it('uses coded errors for invalid standalone color values', () => {
    assert.throws(
      () => parseColor('rgb(300, 0, 0)'),
      (error: unknown) => error instanceof FunctionError && error.code === 'RGB_OUT_OF_RANGE',
    );

    assert.throws(
      () => parseColor('blue'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_COLOR',
    );
  });

  it('matches APCA 0.0.98G-4g vectors', () => {
    const vectors: [string, string, number][] = [
      ['#000', '#fff', 106.04],
      ['#fff', '#000', -107.88],
      ['#888', '#fff', 63.06],
      ['#fff', '#888', -68.54],
      ['#000', '#aaa', 58.15],
      ['#aaa', '#000', -56.24],
      ['#123', '#def', 91.67],
      ['#2563eb', '#fff', 74.86],
      ['#808080', '#808080', 0],
    ];

    for (const [text, background, lc] of vectors) {
      assert.ok(
        Math.abs(apcaContrast(parseColor(text), parseColor(background)) - lc) < 0.005,
        `${text} on ${background}`,
      );
    }
  });
});
