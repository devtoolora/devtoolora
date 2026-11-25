import type { CssColor } from './cssColor';
import {
  degrees,
  fromLinear,
  linearToOklab,
  oklabToLinear,
  polar,
  toLinear,
  type Vector,
} from './cssColorSpace';
import { mapToGamut } from './gamut';

type MixSpace = 'oklab' | 'oklch' | 'srgb';

const powerlessChroma = 0.0002;

function toSpace(color: CssColor, space: MixSpace): Vector {
  const { unmappedLinear } = color;

  if (space === 'srgb')
    return unmappedLinear
      ? (unmappedLinear.map(fromLinear) as Vector)
      : [color.r, color.g, color.b];

  const [lightness, a, b] = linearToOklab(
    unmappedLinear ?? ([color.r, color.g, color.b].map(toLinear) as Vector),
  );

  return space === 'oklab' ? [lightness, a, b] : [lightness, Math.hypot(a, b), degrees(a, b)];
}

function mixHue(a: Vector, b: Vector, weight: number): number {
  const hueA = a[1] < powerlessChroma ? b[2] : a[2];
  let hueB = b[1] < powerlessChroma ? a[2] : b[2];

  if (hueB - hueA > 180) hueB -= 360;
  else if (hueB - hueA < -180) hueB += 360;

  return hueA * weight + hueB * (1 - weight);
}

export function mixColors(a: CssColor, b: CssColor, weightA: number, space: MixSpace): CssColor {
  const weightB = 1 - weightA;
  const alpha = a.alpha * weightA + b.alpha * weightB;
  const [va, vb] = [toSpace(a, space), toSpace(b, space)];
  const premultiplied = (index: number) =>
    alpha === 0
      ? 0
      : ((va[index] ?? 0) * a.alpha * weightA + (vb[index] ?? 0) * b.alpha * weightB) / alpha;
  const source = 'color-mix()';
  const [first, second] = [premultiplied(0), premultiplied(1)];
  const third = space === 'oklch' ? mixHue(va, vb, weightA) : premultiplied(2);

  if (space === 'srgb') {
    const clamp = (value: number) => Math.min(1, Math.max(0, value));

    return {
      alpha,
      b: clamp(third),
      g: clamp(second),
      gamutMapped: [first, second, third].some((channel) => channel < 0 || channel > 1),
      r: clamp(first),
      source,
    };
  }

  const [x, y] = space === 'oklch' ? polar(second, third) : [second, third];

  return mapToGamut(oklabToLinear([first, x, y]), alpha, source);
}
