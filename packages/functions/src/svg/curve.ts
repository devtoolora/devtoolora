import { parseCssColor } from '../color/cssColor';
import { trim } from '../color/cssColorSpace';
import { FunctionError } from '../errors';

type Point = [number, number];

const fmt = (point: Point) => `${trim(point[0], 2)} ${trim(point[1], 2)}`;

export function catmullRomPath(
  points: Array<[number, number]>,
  closed: boolean,
  bounds?: [number, number],
): string {
  const count = points.length;

  const at = (index: number): Point => {
    const wrapped = closed ? (index + count) % count : Math.min(count - 1, Math.max(0, index));

    return points[wrapped] ?? [0, 0];
  };

  const clampY = (y: number) => (bounds ? Math.min(bounds[1], Math.max(bounds[0], y)) : y);
  const segments = closed ? count : count - 1;
  let path = `M${fmt(at(0))}`;

  for (let index = 0; index < segments; index += 1) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];

    path += `C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }

  return closed ? `${path}Z` : path;
}

/** Parsing rejects anything but a plain CSS color, so the value is safe inside an attribute. */
export function opaqueColor(value: string, label: string): string {
  const color = value.trim();

  if (parseCssColor(color).alpha < 1)
    throw new FunctionError(
      'SVG_COLOR_ALPHA',
      `${label} must be opaque; remove the alpha channel.`,
    );

  return color;
}
