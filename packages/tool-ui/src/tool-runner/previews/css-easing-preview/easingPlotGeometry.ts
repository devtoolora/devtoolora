import type { BezierPoints } from '@devtoolora/functions/css';

export type Point = [number, number];
export type YRange = [number, number];

export type PlotFrame = { left: number; range: YRange; unit: number };

// A fixed viewBox with the plot box's own 7:8 shape, so labels and handles keep one size on screen.
export const plotView = { height: 320, width: 280 };

const pad = { bottom: 36, left: 48, right: 12, top: 12 };
const plotWidth = plotView.width - pad.left - pad.right;
const plotHeight = plotView.height - pad.top - pad.bottom;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const clampPoint = ([x, y]: Point): Point => [
  round2(Math.min(1, Math.max(0, x))),
  round2(Math.min(2, Math.max(-1, y))),
];

export const plotRange = ([, y1, , y2]: BezierPoints): YRange => [
  round2(Math.max(-1, Math.min(0, y1, y2) - 0.15)),
  round2(Math.min(2, Math.max(1, y1, y2) + 0.15)),
];

export function plotFrame(range: YRange): PlotFrame {
  const unit = round2(Math.min(plotWidth, plotHeight / (range[1] - range[0])));

  return { left: round2(pad.left + (plotWidth - unit) / 2), range, unit };
}

export const toSvg = ({ left, range, unit }: PlotFrame, [x, y]: Point): Point => [
  round2(left + x * unit),
  round2(pad.top + (range[1] - y) * unit),
];
