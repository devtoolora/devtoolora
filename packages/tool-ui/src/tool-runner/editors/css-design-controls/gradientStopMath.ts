import { parseCssColor } from '@devtoolora/functions/color';
import type { GradientStop } from '@devtoolora/functions/css';

const neutralHex = '#808080';

export const clampPosition = (position: number): number =>
  Math.min(100, Math.max(0, Math.round(position * 100) / 100));

export function readStops(value: string): GradientStop[] | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) return undefined;

  return parsed.map((stop: unknown) => {
    const { color, position } = (stop && typeof stop === 'object' ? stop : {}) as Partial<
      Record<keyof GradientStop, unknown>
    >;

    return {
      color: typeof color === 'string' ? color : '',
      position: typeof position === 'number' && Number.isFinite(position) ? position : 0,
    };
  });
}

const hexPair = (channel: number): string =>
  Math.round(channel * 255)
    .toString(16)
    .padStart(2, '0');

export function pickerHex(color: string): { alpha: number; hex: string } {
  try {
    const { alpha, b, g, r } = parseCssColor(color);

    return { alpha, hex: `#${[r, g, b].map(hexPair).join('')}` };
  } catch {
    return { alpha: 1, hex: neutralHex };
  }
}

export function pickedColor(hex: string, alpha: number): string {
  const lower = hex.toLowerCase();

  return alpha < 1 ? `${lower}${hexPair(alpha)}` : lower;
}

/** The color halfway between two stops, premultiplied by alpha like the browser blends it. */
function midpointColor(left: string, right: string): string | undefined {
  try {
    const [start, end] = [parseCssColor(left), parseCssColor(right)];
    const alpha = (start.alpha + end.alpha) / 2;
    const channel = (key: 'b' | 'g' | 'r'): number =>
      alpha === 0
        ? (start[key] + end[key]) / 2
        : (start[key] * start.alpha + end[key] * end.alpha) / 2 / alpha;

    return pickedColor(
      `#${[channel('r'), channel('g'), channel('b')].map(hexPair).join('')}`,
      alpha,
    );
  } catch {
    return undefined;
  }
}

type StopGap = { color: string; index: number; position: number; width: number };

function stopGaps(stops: GradientStop[]): StopGap[] {
  const order = stops.map((stop, index) => ({ index, stop }));

  order.sort((left, right) => left.stop.position - right.stop.position);

  const first = order[0];
  const last = order.at(-1);

  if (!first || !last) return [];

  const between = order.slice(1).map((right, step): StopGap => {
    const left = order[step] ?? right;

    return {
      color: midpointColor(left.stop.color, right.stop.color) ?? left.stop.color,
      index: left.index + 1,
      position: (left.stop.position + right.stop.position) / 2,
      width: right.stop.position - left.stop.position,
    };
  });

  return [
    {
      ...first.stop,
      index: first.index,
      position: first.stop.position / 2,
      width: first.stop.position,
    },
    ...between,
    {
      ...last.stop,
      index: last.index + 1,
      position: (last.stop.position + 100) / 2,
      width: 100 - last.stop.position,
    },
  ];
}

export function insertedStops(stops: GradientStop[]): GradientStop[] {
  const widest = stopGaps(stops).reduce<StopGap | undefined>(
    (best, gap) => (!best || gap.width > best.width ? gap : best),
    undefined,
  );

  if (!widest) return stops;

  const stop = { color: widest.color, position: clampPosition(widest.position) };

  return [...stops.slice(0, widest.index), stop, ...stops.slice(widest.index)];
}
