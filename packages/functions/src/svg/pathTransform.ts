import { FunctionError } from '../errors';
import { mapValues, toAbsolute, toRelative } from './pathFormat';
import type { PathSegment } from './pathParse';

const SCALE_ERROR = 'Scale must be between 0.001 and 1,000 (or -0.001 and -1,000).';
const ARC_NOTE = 'Arcs were converted to cubic Béziers because the scale is not uniform.';

const OVERFLOW_ERROR = 'Coordinates must stay finite; this transform overflows.';

function assertFinite(segments: PathSegment[]): PathSegment[] {
  if (segments.some((segment) => segment.values.some((value) => !Number.isFinite(value)))) {
    throw new FunctionError('SVG_PATH_ERROR', OVERFLOW_ERROR);
  }

  return segments;
}

// A relative segment only moves when it is the leading `m`, which starts from the origin.
export function translatePath(segments: PathSegment[], dx: number, dy: number): PathSegment[] {
  return assertFinite(
    segments.map((segment, index) => {
      if (segment.relative && index !== 0) return segment;

      return {
        ...segment,
        values: mapValues(
          segment.letter,
          segment.values,
          (n) => n + dx,
          (n) => n + dy,
        ),
      };
    }),
  );
}

type ArcCenter = { cx: number; cy: number; delta: number; rx: number; ry: number; theta1: number };

/** Endpoint to center parameterization with radii scaling (SVG 2 F.6.5-F.6.6). */
export function arcCenter(x1: number, y1: number, arc: number[]): ArcCenter {
  const [rx0 = 0, ry0 = 0, phiDeg = 0, large = 0, sweep = 0, x = 0, y = 0] = arc;
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const hx = (x1 - x) / 2;
  const hy = (y1 - y) / 2;
  const x1p = cos * hx + sin * hy;
  const y1p = -sin * hx + cos * hy;
  const lambda = (x1p * x1p) / (rx0 * rx0) + (y1p * y1p) / (ry0 * ry0);
  const grow = lambda > 1 ? Math.sqrt(lambda) : 1;
  const rx = Math.abs(rx0) * grow;
  const ry = Math.abs(ry0) * grow;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const theta2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let delta = theta2 - theta1;

  if (sweep && delta < 0) delta += 2 * Math.PI;
  if (!sweep && delta > 0) delta -= 2 * Math.PI;

  return {
    cx: cos * cxp - sin * cyp + (x1 + x) / 2,
    cy: sin * cxp + cos * cyp + (y1 + y) / 2,
    delta,
    rx,
    ry,
    theta1,
  };
}

export function arcToCubics(x1: number, y1: number, arc: number[]): number[][] {
  const [rx0 = 0, ry0 = 0, phiDeg = 0, , , x = 0, y = 0] = arc;

  if (x1 === x && y1 === y) return [];
  if (rx0 === 0 || ry0 === 0) {
    const dx = (x - x1) / 3;
    const dy = (y - y1) / 3;

    return [[x1 + dx, y1 + dy, x1 + 2 * dx, y1 + 2 * dy, x, y]];
  }

  const { cx, cy, delta, rx, ry, theta1 } = arcCenter(x1, y1, arc);
  const cos = Math.cos((phiDeg * Math.PI) / 180);
  const sin = Math.sin((phiDeg * Math.PI) / 180);
  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (a: number) => [
    cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin,
    cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos,
  ];
  const tangent = (a: number) => [
    -rx * Math.sin(a) * cos - ry * Math.cos(a) * sin,
    -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos,
  ];

  return Array.from({ length: count }, (_, i) => {
    const a1 = theta1 + i * step;
    const a2 = a1 + step;
    const [p1x = 0, p1y = 0] = point(a1);
    const [t1x = 0, t1y = 0] = tangent(a1);
    const [p2x = 0, p2y = 0] = point(a2);
    const [t2x = 0, t2y = 0] = tangent(a2);
    const last = i === count - 1;

    return [
      p1x + k * t1x,
      p1y + k * t1y,
      p2x - k * t2x,
      p2y - k * t2y,
      last ? x : p2x,
      last ? y : p2y,
    ];
  });
}

function arcsToCubics(segments: PathSegment[]): PathSegment[] {
  const absolute = toAbsolute(segments);
  const out: PathSegment[] = [];
  const relativeFlags: boolean[] = [];
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let afterArc = false;

  absolute.forEach((segment, index) => {
    const v = segment.values;
    const relative = segments[index]?.relative ?? false;

    const push = (item: PathSegment) => {
      out.push(item);
      relativeFlags.push(relative);
    };

    if (segment.letter === 'A') {
      arcToCubics(current.x, current.y, v).forEach((values, i) =>
        push({ explicit: segment.explicit && i === 0, letter: 'C', relative: false, values }),
      );
    } else if (segment.letter === 'S' && afterArc) {
      // After an arc the first control of S is the current point, not a reflection.
      push({ ...segment, letter: 'C', values: [current.x, current.y, ...v] });
    } else {
      push(segment);
    }

    afterArc = segment.letter === 'A';
    if (segment.letter === 'Z') current = start;
    else if (segment.letter === 'H') current = { x: v[0] ?? 0, y: current.y };
    else if (segment.letter === 'V') current = { x: current.x, y: v[0] ?? 0 };
    else current = { x: v[v.length - 2] ?? 0, y: v[v.length - 1] ?? 0 };
    if (segment.letter === 'M') start = current;
  });

  const relatives = toRelative(out);

  return out.map((segment, i) => (relativeFlags[i] ? (relatives[i] ?? segment) : segment));
}

export function scalePath(
  segments: PathSegment[],
  sx: number,
  sy: number,
): { notes: string[]; segments: PathSegment[] } {
  const inRange = (s: number) => Number.isFinite(s) && Math.abs(s) >= 0.001 && Math.abs(s) <= 1000;

  if (!inRange(sx) || !inRange(sy)) throw new FunctionError('SVG_PATH_ERROR', SCALE_ERROR);

  const uniform = Math.abs(sx) === Math.abs(sy);
  const convert = !uniform && segments.some((segment) => segment.letter === 'A');
  const source = convert ? arcsToCubics(segments) : segments;
  const mirrored = sx * sy < 0;

  const scaled = source.map((segment) => {
    const values = mapValues(
      segment.letter,
      segment.values,
      (n) => n * sx,
      (n) => n * sy,
    );

    if (segment.letter === 'A') {
      const [rx = 0, ry = 0, phi = 0, large = 0, sweep = 0] = segment.values;
      const scale = Math.abs(sx);

      values.splice(
        0,
        5,
        rx * scale,
        ry * scale,
        mirrored ? -phi : phi,
        large,
        mirrored ? 1 - sweep : sweep,
      );
    }

    return { ...segment, values };
  });

  return { notes: convert ? [ARC_NOTE] : [], segments: assertFinite(scaled) };
}
