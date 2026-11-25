import { FunctionError } from '../errors';
import type { HslColor, RgbColor } from './types';

export function hexToRgb(hex: string): RgbColor {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());

  if (!match) {
    throw new FunctionError('INVALID_HEX_COLOR', 'Hex color must use three or six digits.');
  }

  const digits = match[1]!;
  const value =
    digits.length === 3
      ? digits
          .split('')
          .map((character) => character + character)
          .join('')
      : digits;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RgbColor): string {
  assertRgb(rgb);

  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  assertRgb(rgb);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const h = hueDegrees(r, g, b, max, delta);

  return {
    h: (h + 360) % 360,
    s: (delta / (1 - Math.abs(2 * l - 1))) * 100,
    l: l * 100,
  };
}

function hueDegrees(r: number, g: number, b: number, max: number, delta: number): number {
  if (max === r) return 60 * (((g - b) / delta) % 6);
  if (max === g) return 60 * ((b - r) / delta + 2);

  return 60 * ((r - g) / delta + 4);
}

export function hslToRgb(hsl: HslColor): RgbColor {
  if (
    ![hsl.h, hsl.s, hsl.l].every(Number.isFinite) ||
    hsl.s < 0 ||
    hsl.s > 100 ||
    hsl.l < 0 ||
    hsl.l > 100
  ) {
    throw new FunctionError(
      'HSL_OUT_OF_RANGE',
      'HSL saturation and lightness must be between 0 and 100.',
    );
  }

  const h = ((hsl.h % 360) + 360) % 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const sectors: Array<[number, number, number]> = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  const sector = sectors[Math.floor(h / 60)];

  if (!sector) throw new FunctionError('HSL_OUT_OF_RANGE', 'HSL hue must be a finite number.');

  const [r, g, b] = sector;

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function assertRgb(rgb: RgbColor): void {
  if (
    ![rgb.r, rgb.g, rgb.b].every(Number.isFinite) ||
    [rgb.r, rgb.g, rgb.b].some((channel) => channel < 0 || channel > 255)
  ) {
    throw new FunctionError('RGB_OUT_OF_RANGE', 'RGB channel is outside 0-255.');
  }
}
