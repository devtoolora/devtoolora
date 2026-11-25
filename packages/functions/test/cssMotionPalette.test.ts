import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateKeyframesCss } from '../src/css';
import { generatePalette, parseColor, parsePaletteScheme, rgbToHsl } from '../src/color';

const motion = {
  delay: 0,
  direction: 'normal',
  distance: 40,
  duration: 900,
  easing: 'ease-out',
  fillMode: 'both',
  iterations: '1',
  name: 'motion-demo',
  opacity: 0,
  preset: 'fade-up',
  scale: 80,
};

describe('CSS motion and color palette', () => {
  it('distinguishes opposite motion and preserves fractional or zero iterations', () => {
    for (const [preset, offset] of [
      ['fade-up', 'translateY(40px)'],
      ['fade-down', 'translateY(-40px)'],
      ['slide-left', 'translateX(40px)'],
      ['slide-right', 'translateX(-40px)'],
    ])
      assert.match(
        generateKeyframesCss({ ...motion, preset: preset! }),
        new RegExp(offset!.replace(/[()]/g, '\\$&')),
      );
    for (const iterations of ['0', '0.5', '99', 'infinite'])
      assert.ok(
        generateKeyframesCss({ ...motion, iterations }).includes(`${iterations} normal both`),
      );
    for (const iterations of ['', '-1', '100', '1e1', 'NaN'])
      assert.throws(() => generateKeyframesCss({ ...motion, iterations }));
    for (const name of ['', 'none', 'linear', '-1bad', 'bad name', 'x'.repeat(65), 'a{}'])
      assert.throws(() => generateKeyframesCss({ ...motion, name }));
    for (const field of ['direction', 'easing', 'fillMode', 'preset'])
      assert.throws(() => generateKeyframesCss({ ...motion, [field]: 'bad' }));
    assert.throws(() => generateKeyframesCss({ ...motion, duration: 100.5 }));
  });

  it('keeps exact bases, ordered lightness and neutral colors without inventing saturation', () => {
    for (const color of ['#2563eb', '#808080', '#000000', '#ffffff', '#ffcccc']) {
      for (const scheme of ['complementary', 'analogous', 'triadic', 'split']) {
        const families = generatePalette(parseColor(color), parsePaletteScheme(scheme));

        assert.equal(families[0]!.base, color);
        assert.equal(families[0]!.shades[500], color);

        for (const family of families) {
          const lightness = Object.values(family.shades).map(
            (shade) => rgbToHsl(parseColor(shade)).l,
          );

          assert.ok(
            lightness.every((value, index) => index === 0 || value <= lightness[index - 1]!),
          );

          if (color === '#808080') assert.equal(family.base, '#808080');
        }
      }
    }

    assert.throws(() => parsePaletteScheme('bad'));
  });

  it('rejects animation names that the shorthand would read as another keyword', () => {
    for (const name of ['step-start', 'STEP-END', 'auto'])
      assert.throws(() => generateKeyframesCss({ ...motion, name }), /non-reserved/, name);
  });
});
