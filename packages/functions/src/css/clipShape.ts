import { FunctionError } from '../errors';
import { parsePolygonPoints, validatePolygonPoints, type PolygonPoint } from './polygon';

export type ClipShape =
  | { kind: 'polygon'; points: PolygonPoint[] }
  | { kind: 'circle'; radius: number; x: number; y: number }
  | { kind: 'ellipse'; radiusX: number; radiusY: number; x: number; y: number }
  | { bottom: number; kind: 'inset'; left: number; right: number; round: number; top: number };

/** Field defaults shared by the tool, the web editor and the VS Code workspace. */
export const clipShapeDefaults: Readonly<Record<string, string>> = {
  centerX: '50',
  centerY: '50',
  insetBottom: '10',
  insetLeft: '10',
  insetRight: '10',
  insetRound: '0',
  insetTop: '10',
  points: '[[50,0],[100,100],[0,100]]',
  radius: '50',
  radiusX: '50',
  radiusY: '35',
  shape: 'polygon',
};

const labels = {
  centerX: 'Center X',
  centerY: 'Center Y',
  insetBottom: 'Inset bottom',
  insetLeft: 'Inset left',
  insetRight: 'Inset right',
  insetRound: 'Corner radius',
  insetTop: 'Inset top',
  radius: 'Radius',
  radiusX: 'Radius X',
  radiusY: 'Radius Y',
};

function clipError(message: string): FunctionError {
  return new FunctionError('INVALID_CSS', message);
}

function measure(value: number, label: string, maximum = 100): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum)
    throw clipError(`${label} must be a number from 0 to ${maximum}. Values are not clamped.`);

  return Math.round(value * 100) / 100;
}

export function clipPathValue(shape: ClipShape): string {
  switch (shape.kind) {
    case 'polygon':
      return `polygon(${validatePolygonPoints(shape.points)
        .map(([x, y]) => `${x}% ${y}%`)
        .join(', ')})`;
    case 'circle':
      return `circle(${measure(shape.radius, labels.radius)}% at ${measure(shape.x, labels.centerX)}% ${measure(shape.y, labels.centerY)}%)`;
    case 'ellipse':
      return `ellipse(${measure(shape.radiusX, labels.radiusX)}% ${measure(shape.radiusY, labels.radiusY)}% at ${measure(shape.x, labels.centerX)}% ${measure(shape.y, labels.centerY)}%)`;

    case 'inset': {
      const [top, right, bottom, left] = [
        measure(shape.top, labels.insetTop),
        measure(shape.right, labels.insetRight),
        measure(shape.bottom, labels.insetBottom),
        measure(shape.left, labels.insetLeft),
      ];

      if (top + bottom >= 100)
        throw clipError(
          'Inset top and bottom together must stay below 100%, or nothing remains visible.',
        );
      if (left + right >= 100)
        throw clipError(
          'Inset left and right together must stay below 100%, or nothing remains visible.',
        );

      const round = measure(shape.round, labels.insetRound, 200);

      return `inset(${top}% ${right}% ${bottom}% ${left}%${round ? ` round ${round}px` : ''})`;
    }

    default:
      throw clipError('Choose Polygon, Circle, Ellipse or Inset.');
  }
}

function numberField(fields: Record<string, string | undefined>, id: keyof typeof labels): number {
  const raw = (fields[id] ?? clipShapeDefaults[id] ?? '').trim();

  if (!/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(raw))
    throw clipError(
      `${labels[id]} must be a number from 0 to ${id === 'insetRound' ? 200 : 100}. Values are not clamped.`,
    );

  return Number(raw);
}

export function clipShapeFromFields(fields: Record<string, string | undefined>): ClipShape {
  const kind = fields.shape || 'polygon';

  if (kind === 'polygon')
    return { kind, points: parsePolygonPoints(fields.points ?? clipShapeDefaults.points ?? '') };
  if (kind === 'circle')
    return {
      kind,
      radius: numberField(fields, 'radius'),
      x: numberField(fields, 'centerX'),
      y: numberField(fields, 'centerY'),
    };
  if (kind === 'ellipse')
    return {
      kind,
      radiusX: numberField(fields, 'radiusX'),
      radiusY: numberField(fields, 'radiusY'),
      x: numberField(fields, 'centerX'),
      y: numberField(fields, 'centerY'),
    };
  if (kind === 'inset')
    return {
      bottom: numberField(fields, 'insetBottom'),
      kind,
      left: numberField(fields, 'insetLeft'),
      right: numberField(fields, 'insetRight'),
      round: numberField(fields, 'insetRound'),
      top: numberField(fields, 'insetTop'),
    };

  throw clipError('Choose Polygon, Circle, Ellipse or Inset.');
}

/**
 * An .element rule; the -webkit- line is for older Safari and Chromium releases that need the
 * prefix.
 */
export function generateClipShapeCss(shape: ClipShape, options: { webkit?: boolean } = {}): string {
  const value = clipPathValue(shape);

  return `.element {\n${options.webkit ? `  -webkit-clip-path: ${value};\n` : ''}  clip-path: ${value};\n}`;
}
