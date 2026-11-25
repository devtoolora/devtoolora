import type { RgbColor } from './types';

function apcaLuminance({ b, g, r }: RgbColor): number {
  const y =
    0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;

  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

/** Signed APCA 0.0.98G-4g lightness contrast (Lc); positive for dark text on a light background. */
export function apcaContrast(text: RgbColor, background: RgbColor): number {
  const yText = apcaLuminance(text);
  const yBackground = apcaLuminance(background);

  if (Math.abs(yBackground - yText) < 0.0005) return 0;

  if (yBackground > yText) {
    const lc = (yBackground ** 0.56 - yText ** 0.57) * 1.14;

    return (lc < 0.1 ? 0 : lc - 0.027) * 100;
  }

  const lc = (yBackground ** 0.65 - yText ** 0.62) * 1.14;

  return (lc > -0.1 ? 0 : lc + 0.027) * 100;
}
