import { FunctionError } from '../errors';
import { formatCssColor, type CssColor } from './cssColor';
import {
  degrees,
  linearToOklab,
  oklabToLinear,
  polar,
  toLinear,
  type Vector,
} from './cssColorSpace';
import { mapToGamut } from './gamut';

export type ColorScaleStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export type ColorScaleEntry = {
  color: CssColor;
  gamutMapped: boolean;
  hex: string;
  oklch: string;
  step: ColorScaleStep;
};

export const colorScaleSteps: ColorScaleStep[] = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
];

// Median of Tailwind v4's 17 chromatic palettes: OKLCH lightness and chroma relative to the peak.
const ladder: Record<ColorScaleStep, { lightness: number; relativeChroma: number }> = {
  50: { lightness: 0.977, relativeChroma: 0.07 },
  100: { lightness: 0.951, relativeChroma: 0.15 },
  200: { lightness: 0.902, relativeChroma: 0.34 },
  300: { lightness: 0.833, relativeChroma: 0.58 },
  400: { lightness: 0.746, relativeChroma: 0.82 },
  500: { lightness: 0.685, relativeChroma: 0.96 },
  600: { lightness: 0.592, relativeChroma: 0.99 },
  700: { lightness: 0.514, relativeChroma: 0.86 },
  800: { lightness: 0.448, relativeChroma: 0.72 },
  900: { lightness: 0.396, relativeChroma: 0.55 },
  950: { lightness: 0.279, relativeChroma: 0.37 },
};

export function oklchToColor(
  lightness: number,
  chroma: number,
  hue: number,
  source: string,
): CssColor {
  const [a, b] = polar(Math.max(0, chroma), hue);

  return mapToGamut(oklabToLinear([lightness, a, b]), 1, source);
}

export function generateColorScale(input: CssColor): {
  anchor: ColorScaleStep;
  steps: ColorScaleEntry[];
} {
  if (input.alpha < 1)
    throw new FunctionError(
      'COLOR_SCALE_ALPHA',
      'A color scale needs an opaque color. Remove the alpha channel.',
    );

  const [lightness, a, b] = linearToOklab([input.r, input.g, input.b].map(toLinear) as Vector);
  const chroma = Math.hypot(a, b);
  const hue = degrees(a, b);
  const anchor = colorScaleSteps.reduce((best, step) =>
    Math.abs(ladder[step].lightness - lightness) < Math.abs(ladder[best].lightness - lightness)
      ? step
      : best,
  );
  const peak = chroma < 0.0002 ? 0 : chroma / ladder[anchor].relativeChroma;

  return {
    anchor,
    steps: colorScaleSteps.map((step) => {
      const color =
        step === anchor
          ? input
          : oklchToColor(
              ladder[step].lightness,
              peak * ladder[step].relativeChroma,
              hue,
              'oklch()',
            );
      const report = formatCssColor(color);

      return { color, gamutMapped: color.gamutMapped, hex: report.hex, oklch: report.oklch, step };
    }),
  };
}
