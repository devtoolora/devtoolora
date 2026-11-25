import { toAbsolute } from './pathFormat';
import type { PathSegment } from './pathParse';
import { arcCenter, arcToCubics } from './pathTransform';

export type PathBox = { height: number; width: number; x: number; y: number };
export type PathPoint = {
  anchor?: { x: number; y: number };
  index: number;
  kind: 'control' | 'end';
  x: number;
  y: number;
};

type P = { x: number; y: number };
type Curve = [P, P, P, P];

const LENGTH_TOLERANCE = 0.01;
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);

function cubicLength([a, b, c, d]: Curve, depth = 0): number {
  const chord = dist(a, d);
  const poly = dist(a, b) + dist(b, c) + dist(c, d);

  if (depth >= 12 || poly - chord < Math.max(LENGTH_TOLERANCE, poly * 1e-6))
    return (poly + chord) / 2;

  const ab = mid(a, b);
  const bc = mid(b, c);
  const cd = mid(c, d);
  const abc = mid(ab, bc);
  const bcd = mid(bc, cd);
  const m = mid(abc, bcd);

  return cubicLength([a, ab, abc, m], depth + 1) + cubicLength([m, bcd, cd, d], depth + 1);
}

function extrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots: number[] = [];

  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;

    if (disc >= 0) {
      roots.push((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a));
    }
  }

  return roots.filter((t) => t > 0 && t < 1);
}

const at = (t: number, p0: number, p1: number, p2: number, p3: number) => {
  const u = 1 - t;

  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

function cubicExtremes([a, b, c, d]: Curve): P[] {
  return [
    ...extrema(a.x, b.x, c.x, d.x).map((t) => ({
      x: at(t, a.x, b.x, c.x, d.x),
      y: at(t, a.y, b.y, c.y, d.y),
    })),
    ...extrema(a.y, b.y, c.y, d.y).map((t) => ({
      x: at(t, a.x, b.x, c.x, d.x),
      y: at(t, a.y, b.y, c.y, d.y),
    })),
  ];
}

const quadToCubic = (a: P, q: P, d: P): Curve => [
  a,
  { x: a.x + (2 / 3) * (q.x - a.x), y: a.y + (2 / 3) * (q.y - a.y) },
  { x: d.x + (2 / 3) * (q.x - d.x), y: d.y + (2 / 3) * (q.y - d.y) },
  d,
];

function lineEnd(letter: string, v: number[], current: P): P {
  if (letter === 'H') return { x: v[0] ?? 0, y: current.y };
  if (letter === 'V') return { x: current.x, y: v[0] ?? 0 };

  return { x: v[0] ?? 0, y: v[1] ?? 0 };
}

function arcLength(from: P, v: number[]): number {
  const [rx0 = 0, ry0 = 0, phiDeg = 0, , , x = 0, y = 0] = v;

  if (rx0 === 0 || ry0 === 0 || (from.x === x && from.y === y)) return dist(from, { x, y });

  const { cx, cy, delta, rx, ry, theta1 } = arcCenter(from.x, from.y, v);
  const phi = (phiDeg * Math.PI) / 180;
  const estimate = (rx + ry) * Math.abs(delta);
  const pieces = Math.min(
    20000,
    Math.max(8, Math.ceil(Math.abs(delta) / Math.sqrt(0.12 / estimate))),
  );
  let total = 0;
  let previous = from;

  for (let i = 1; i <= pieces; i += 1) {
    const a = theta1 + (delta * i) / pieces;
    const next =
      i === pieces
        ? { x, y }
        : {
            x: cx + rx * Math.cos(a) * Math.cos(phi) - ry * Math.sin(a) * Math.sin(phi),
            y: cy + rx * Math.cos(a) * Math.sin(phi) + ry * Math.sin(a) * Math.cos(phi),
          };

    total += dist(previous, next);
    previous = next;
  }

  return total;
}

function arcCurves(from: P, v: number[]): Curve[] {
  let previous = from;

  return arcToCubics(from.x, from.y, v).map(([x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0]) => {
    const to = { x: x3, y: y3 };
    const curve: Curve = [previous, { x: x1, y: y1 }, { x: x2, y: y2 }, to];

    previous = to;

    return curve;
  });
}

type Walk = {
  arcCurves: Curve[];
  arcLength: number;
  curves: Curve[];
  ends: P[];
  lineLength: number;
  points: PathPoint[];
};

function walkPath(segments: PathSegment[]): Walk {
  const walk: Walk = {
    arcCurves: [],
    arcLength: 0,
    curves: [],
    ends: [],
    lineLength: 0,
    points: [],
  };
  let current: P = { x: 0, y: 0 };
  let start: P = current;
  let lastCubic: P | undefined;
  let lastQuad: P | undefined;

  toAbsolute(segments).forEach((segment, index) => {
    const v = segment.values;
    const p = (i: number): P => ({ x: v[i] ?? 0, y: v[i + 1] ?? 0 });
    const reflect = (control: P | undefined) =>
      control ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y } : current;
    const control = (at: P, anchor: P) =>
      walk.points.push({ anchor, index, kind: 'control', ...at });
    let end: P = current;
    let nextCubic: P | undefined;
    let nextQuad: P | undefined;

    if (segment.letter === 'M') {
      end = p(0);
      start = end;
    } else if (segment.letter === 'L' || segment.letter === 'H' || segment.letter === 'V') {
      end = lineEnd(segment.letter, v, current);
      walk.lineLength += dist(current, end);
    } else if (segment.letter === 'Z') {
      end = start;
      walk.lineLength += dist(current, end);
    } else if (segment.letter === 'C' || segment.letter === 'S') {
      const isC = segment.letter === 'C';
      const c1 = isC ? p(0) : reflect(lastCubic);
      const c2 = isC ? p(2) : p(0);

      end = isC ? p(4) : p(2);
      if (isC) control(c1, current);

      control(c2, end);
      walk.curves.push([current, c1, c2, end]);
      nextCubic = c2;
    } else if (segment.letter === 'Q' || segment.letter === 'T') {
      const q = segment.letter === 'Q' ? p(0) : reflect(lastQuad);

      end = segment.letter === 'Q' ? p(2) : p(0);
      control(q, current);
      walk.curves.push(quadToCubic(current, q, end));
      nextQuad = q;
    } else {
      end = p(5);
      walk.arcCurves.push(...arcCurves(current, v));
      walk.arcLength += arcLength(current, v);
    }

    if (segment.letter !== 'Z') walk.points.push({ index, kind: 'end', ...end });

    walk.ends.push(end);
    current = end;
    lastCubic = nextCubic;
    lastQuad = nextQuad;
  });

  return walk;
}

export function measurePath(segments: PathSegment[]): {
  bbox: PathBox;
  commands: number;
  length: number;
  points: PathPoint[];
  segments: number;
  subpaths: number;
} {
  const {
    arcCurves: arcShapes,
    arcLength: arcs,
    curves,
    ends,
    lineLength,
    points,
  } = walkPath(segments);
  // An arc's split points are not path ends, yet an extreme of the ellipse can fall on one.
  const arcSplits = arcShapes.flatMap(([first, , , last]) => [first, last]);
  const all = [...ends, ...arcSplits, ...[...curves, ...arcShapes].flatMap(cubicExtremes)];
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const x = all.length > 0 ? Math.min(...xs) : 0;
  const y = all.length > 0 ? Math.min(...ys) : 0;

  return {
    bbox: {
      height: all.length > 0 ? Math.max(...ys) - y : 0,
      width: all.length > 0 ? Math.max(...xs) - x : 0,
      x,
      y,
    },
    commands: segments.filter((segment) => segment.explicit).length,
    length: lineLength + arcs + curves.reduce((sum, curve) => sum + cubicLength(curve), 0),
    points,
    segments: segments.length,
    subpaths: segments.filter((segment) => segment.letter === 'M').length,
  };
}
