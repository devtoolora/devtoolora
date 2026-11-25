import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  fluidClamp,
  generateGlassCss,
  generateLoaderCss,
  cssColorHex,
  resolveEasing,
  generateNeumorphismCss,
  neumorphismColors,
  type GlassOptions,
  type NeumorphismOptions,
} from '../src/css';

const glass: GlassOptions = {
  blur: 12,
  borderOpacity: 30,
  cornerRadius: 16,
  saturation: 140,
  tint: '#ffffff',
  tintOpacity: 20,
};

const neu: NeumorphismOptions = {
  baseColor: '#e0e5ec',
  blur: 20,
  cornerRadius: 16,
  intensity: 15,
  offset: 10,
  shape: 'flat',
};

describe('generateGlassCss', () => {
  it('prints the default glass rule', () => {
    assert.equal(
      generateGlassCss(glass),
      '.glass {\n  background: rgba(255, 255, 255, 0.2);\n  -webkit-backdrop-filter: blur(12px) saturate(140%);\n  backdrop-filter: blur(12px) saturate(140%);\n  border: 1px solid rgba(255, 255, 255, 0.3);\n  border-radius: 16px;\n}',
    );
  });

  it('rejects non-colors and injection', () => {
    for (const tint of ['#fff}', '#ffffff; x', 'nope'])
      assert.throws(() => generateGlassCss({ ...glass, tint }), tint);
  });
});

describe('neumorphism', () => {
  it('derives dark and light shades', () => {
    assert.deepEqual(neumorphismColors('#e0e5ec', 15), { dark: '#bec3c9', light: '#ffffff' });
    assert.deepEqual(neumorphismColors('#e0e5ec', 7.5), { dark: '#cfd4da', light: '#f1f6fe' });
  });

  it('prints flat, pressed, concave and convex rules', () => {
    const flat = generateNeumorphismCss(neu);

    assert.equal(
      flat,
      '.neumorphism {\n  background: #e0e5ec;\n  box-shadow: 10px 10px 20px #bec3c9, -10px -10px 20px #ffffff;\n  border-radius: 16px;\n}',
    );

    assert.match(
      generateNeumorphismCss({ ...neu, shape: 'pressed' }),
      /box-shadow: inset 10px 10px 20px #bec3c9, inset -10px -10px 20px #ffffff;/,
    );

    assert.match(
      generateNeumorphismCss({ ...neu, shape: 'concave' }),
      /linear-gradient\(145deg, #cfd4da, #f1f6fe\)/,
    );

    assert.match(
      generateNeumorphismCss({ ...neu, shape: 'convex' }),
      /linear-gradient\(145deg, #f1f6fe, #cfd4da\)/,
    );
  });

  it('rejects invalid base colors', () => {
    for (const baseColor of ['#fff}', '#ffffff; x', 'nope'])
      assert.throws(() => generateNeumorphismCss({ ...neu, baseColor }), baseColor);
  });
});

describe('shared hex validation and typed css errors', () => {
  it('cssColorHex resolves any opaque css color to lowercase #rrggbb', () => {
    assert.equal(cssColorHex('rebeccapurple', 'Color'), '#663399');
    assert.equal(cssColorHex(' Tomato ', 'Color'), '#ff6347');

    assert.throws(
      () => cssColorHex('rgb(0 0 0 / 50%)', 'Color'),
      (error: Error & { code?: string }) => error.message === 'Color must be opaque.',
    );

    assert.throws(() => cssColorHex('nope', 'Color'));
  });

  it('accepts named colors in the loader and neumorphism', () => {
    assert.ok(
      generateLoaderCss({
        color: 'tomato',
        duration: 1000,
        loaderSize: 40,
        preset: 'pulse',
        thickness: 4,
        trackColor: '#000000',
      }).includes('#ff6347'),
    );

    assert.ok(generateNeumorphismCss({ ...neu, baseColor: 'lavender' }).includes('#e6e6fa'));
  });

  it('throws coded errors from fluid, loader and easing', () => {
    const coded = (error: Error & { code?: string }): boolean =>
      typeof error.code === 'string' && error.code.length > 0;

    assert.throws(
      () =>
        fluidClamp({
          maxSize: 10,
          maxViewport: 1200,
          minSize: 10,
          minViewport: 320,
          rootSize: 16,
          unit: 'rem',
        } as Parameters<typeof fluidClamp>[0]),
      coded,
    );

    assert.throws(
      () =>
        generateLoaderCss({
          color: 'nope',
          duration: 1000,
          loaderSize: 40,
          preset: 'pulse',
          thickness: 4,
          trackColor: '#000000',
        }),
      coded,
    );

    assert.throws(() => resolveEasing('nope', [0, 0, 1, 1]), coded);
  });
});
