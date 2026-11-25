import type { CssColor } from './cssColor';
import { clamp, fromLinear, linearToOklab, oklabToLinear, type Vector } from './cssColorSpace';

export function mapToGamut(linear: Vector, alpha: number, source: string): CssColor {
  const inGamut = (vector: Vector) =>
    vector.every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);

  const toSrgb = (channel: number) => clamp(fromLinear(channel), 0, 1);

  if (inGamut(linear)) {
    const [r, g, b] = linear;

    return { alpha, b: toSrgb(b), g: toSrgb(g), gamutMapped: false, r: toSrgb(r), source };
  }

  const [lightness, a, b] = linearToOklab(linear);

  const mapped = { alpha, gamutMapped: true, source, unmappedLinear: linear };

  if (lightness >= 1) return { ...mapped, b: 1, g: 1, r: 1 };
  if (lightness <= 0) return { ...mapped, b: 0, g: 0, r: 0 };

  const chroma = Math.hypot(a, b);
  const angle = Math.atan2(b, a);
  let low = 0;
  let high = chroma;

  for (let step = 0; step < 32; step += 1) {
    const middle = (low + high) / 2;

    if (inGamut(oklabToLinear([lightness, middle * Math.cos(angle), middle * Math.sin(angle)])))
      low = middle;
    else high = middle;
  }

  const [r, g, blue] = oklabToLinear([lightness, low * Math.cos(angle), low * Math.sin(angle)]);

  return { ...mapped, b: toSrgb(blue), g: toSrgb(g), r: toSrgb(r) };
}
