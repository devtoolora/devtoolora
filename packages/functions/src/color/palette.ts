import { hslToRgb, rgbToHex, rgbToHsl } from './conversion';
import type { PaletteFamily, PaletteScheme, RgbColor } from './types';
import { FunctionError } from '../errors';

export function paletteOffsets(scheme: PaletteScheme): number[] {
  if (scheme === 'triadic') return [0, 120, 240];
  if (scheme === 'analogous') return [0, 30, 330];
  if (scheme === 'split') return [0, 150, 210];
  if (scheme === 'complementary') return [0, 180];

  throw new FunctionError(
    'INVALID_PALETTE_SCHEME',
    'Choose complementary, analogous, triadic or split.',
  );
}

export function parsePaletteScheme(value: string): PaletteScheme {
  if (
    value === 'complementary' ||
    value === 'analogous' ||
    value === 'triadic' ||
    value === 'split'
  ) {
    return value;
  }

  throw new FunctionError(
    'INVALID_PALETTE_SCHEME',
    'Choose complementary, analogous, triadic or split.',
  );
}

export function generatePalette(base: RgbColor, scheme: PaletteScheme): PaletteFamily[] {
  const { h: hue, l, s } = rgbToHsl(base);

  return paletteOffsets(scheme).map((offset, index) => {
    const familyHue = (hue + offset) % 360;
    const colorAt = (lightness: number): string =>
      rgbToHex(hslToRgb({ h: familyHue, l: lightness, s }));
    const familyBase = index === 0 ? rgbToHex(base) : colorAt(l);

    return {
      name: index === 0 ? 'base' : `accent${index}`,
      base: familyBase,
      shades: {
        50: colorAt(l + (100 - l) * 0.9),
        200: colorAt(l + (100 - l) * 0.55),
        500: familyBase,
        700: colorAt(l * 0.7),
        900: colorAt(l * 0.35),
      },
    };
  });
}
