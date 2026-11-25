import { FunctionError } from '../errors';

export type PolygonPoint = [number, number];

export const MAX_POLYGON_POINTS = 64;

export function parsePolygonPoints(value: string): PolygonPoint[] {
  if (value.length > 10_000) throw polygonError('Polygon JSON is limited to 10,000 UTF-16 units.');

  let points: unknown;

  try {
    points = JSON.parse(value);
  } catch {
    throw polygonError('Polygon points must be valid JSON.');
  }

  return validatePolygonPoints(points);
}

export function validatePolygonPoints(points: unknown): PolygonPoint[] {
  if (!Array.isArray(points) || points.length < 3 || points.length > MAX_POLYGON_POINTS)
    throw polygonError(`A polygon needs 3 to ${MAX_POLYGON_POINTS} points.`);

  return points.map((point: unknown, index: number) => {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !point.every(
        (coordinate: unknown) =>
          typeof coordinate === 'number' &&
          Number.isFinite(coordinate) &&
          coordinate >= 0 &&
          coordinate <= 100,
      )
    )
      throw polygonError(
        `Point ${index + 1} must contain exactly two finite numeric percentages between 0 and 100. Values are not coerced or clamped.`,
      );

    return [Math.round(point[0] * 100) / 100, Math.round(point[1] * 100) / 100];
  });
}

function polygonError(message: string): FunctionError {
  return new FunctionError('INVALID_CSS', message);
}
