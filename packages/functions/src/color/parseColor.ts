import { FunctionError } from '../errors';
import { hexToRgb, hslToRgb } from './conversion';
import type { RgbColor } from './types';

export function parseColor(value: string): RgbColor {
  const input = value.trim();

  if (!input) {
    throw new FunctionError('REQUIRED_COLOR', 'Color is required.');
  }

  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input)) {
    return hexToRgb(input);
  }

  const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(input);

  if (rgbMatch) {
    const rgb = { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };

    if ([rgb.r, rgb.g, rgb.b].some((channel) => channel > 255)) {
      throw new FunctionError('RGB_OUT_OF_RANGE', 'RGB channel is outside 0-255.');
    }

    return rgb;
  }

  const hslMatch = /^hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)$/i.exec(input);

  if (hslMatch) {
    return hslToRgb({ h: Number(hslMatch[1]), s: Number(hslMatch[2]), l: Number(hslMatch[3]) });
  }

  throw new FunctionError('INVALID_COLOR', 'Color must be hex, rgb(), or hsl().');
}
