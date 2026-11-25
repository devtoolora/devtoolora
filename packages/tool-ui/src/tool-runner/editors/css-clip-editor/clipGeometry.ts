import {
  clipPathValue,
  clipShapeDefaults,
  clipShapeFromFields,
  parsePolygonPoints,
  type PolygonPoint,
} from '@devtoolora/functions/css';
import { coordinate } from './CssClipEditorParts';

export type PolygonMove = { origin: PolygonPoint; points: PolygonPoint[] };

export function editingHint(shape: string): string {
  if (shape === 'polygon')
    return 'Drag a handle, or drag inside the shape to move it. Arrow keys move 1%; Shift+arrow moves 10%.';
  if (shape === 'inset') return 'Set each edge and the corner radius with the sliders.';

  return 'Drag the center handle or use its arrow keys; set the radius with the sliders.';
}

export function canvasPoint(
  canvas: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): PolygonPoint | undefined {
  const bounds = canvas?.getBoundingClientRect();

  if (!bounds?.width || !bounds.height) return;

  return [
    coordinate(((clientX - bounds.left) / bounds.width) * 100),
    coordinate(((clientY - bounds.top) / bounds.height) * 100),
  ];
}

export function movedPolygon(start: PolygonMove, point: PolygonPoint): PolygonPoint[] {
  const xs = start.points.map(([x]) => x);
  const ys = start.points.map(([, y]) => y);
  const dx = Math.max(
    -Math.min(...xs),
    Math.min(100 - Math.max(...xs), point[0] - start.origin[0]),
  );
  const dy = Math.max(
    -Math.min(...ys),
    Math.min(100 - Math.max(...ys), point[1] - start.origin[1]),
  );

  return start.points.map(([x, y]) => [coordinate(x + dx), coordinate(y + dy)]);
}

export function shapeCenter(fields: Record<string, string>): PolygonPoint {
  return [
    Number(fields.centerX ?? clipShapeDefaults.centerX),
    Number(fields.centerY ?? clipShapeDefaults.centerY),
  ];
}

export function parseClipShape(
  fields: Record<string, string>,
  isPolygon: boolean,
): { error: string; points: PolygonPoint[] } {
  let points: PolygonPoint[] = [];
  let error = '';

  try {
    if (isPolygon) points = parsePolygonPoints(fields.points ?? clipShapeDefaults.points ?? '');
    else clipPathValue(clipShapeFromFields(fields));
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'Invalid clip path.';
  }

  return { error, points };
}

export function selectionText(
  isPolygon: boolean,
  points: PolygonPoint[],
  active: number,
  value: string | undefined,
): string | undefined {
  return isPolygon
    ? points[active] && `Selected point ${active + 1}: ${points[active][0]}% ${points[active][1]}%`
    : value && `clip-path: ${value}`;
}
