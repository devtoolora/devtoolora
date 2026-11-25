import { FunctionError } from '../errors';

export type BezierPoints = [number, number, number, number];

const cssKeywords = new Set(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']);

/** The 5 CSS keywords, then the easings.net curves (values from easings.net, 2026-10-27). */
export const easingPresets: Readonly<Record<string, BezierPoints>> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  linear: [0, 0, 1, 1],
  easeInSine: [0.12, 0, 0.39, 0],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
  easeInQuad: [0.11, 0, 0.5, 0],
  easeOutQuad: [0.5, 1, 0.89, 1],
  easeInOutQuad: [0.45, 0, 0.55, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInBack: [0.36, 0, 0.66, -0.56],
  easeOutBack: [0.34, 1.56, 0.64, 1],
  easeInOutBack: [0.68, -0.6, 0.32, 1.6],
};

const round2 = (value: number): number => Number(value.toFixed(2));

export function resolveEasing(
  preset: string,
  custom: BezierPoints,
): { keyword?: string; points: BezierPoints } {
  if (preset === 'custom') return { points: custom };

  const points = Object.hasOwn(easingPresets, preset) ? easingPresets[preset] : undefined;

  if (!points)
    throw new FunctionError(
      'INVALID_EASING_PRESET',
      'Preset must be custom, a CSS keyword or an easings.net curve.',
    );

  return cssKeywords.has(preset) ? { keyword: preset, points } : { points };
}

export function generateEasingCss(points: BezierPoints, durationMs: number): string {
  return [
    ':root {',
    `  --easing: cubic-bezier(${points.map(round2).join(', ')});`,
    '}',
    '',
    '.element {',
    `  transition: transform ${round2(durationMs)}ms var(--easing);`,
    '}',
  ].join('\n');
}

export function parseCubicBezier(css: string): BezierPoints | undefined {
  const values = css
    .match(/cubic-bezier\(([^)]*)\)/)?.[1]
    ?.split(',')
    .map((value) => (value.trim() === '' ? Number.NaN : Number(value)));

  if (values?.length !== 4 || !values.every(Number.isFinite)) return undefined;

  const points = values as BezierPoints;

  return points[0] >= 0 && points[0] <= 1 && points[2] >= 0 && points[2] <= 1 ? points : undefined;
}
