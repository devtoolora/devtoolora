import { FunctionError } from '../errors';
import type { PathLetter, PathSegment } from './pathParse';

export function formatNumber(value: number, precision: number, compact: boolean): string {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new FunctionError('SVG_PATH_ERROR', 'Precision must be between 0 and 6.');
  }

  // toFixed switches to an exponent from 1e21; such doubles are always integers.
  let text = Math.abs(value) >= 1e21 ? BigInt(value).toString() : value.toFixed(precision);

  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  if (text === '-0') text = '0';

  return compact ? text.replace(/^(-?)0\./, '$1.') : text;
}

const letterOf = (segment: PathSegment) =>
  segment.relative ? segment.letter.toLowerCase() : segment.letter;

export function formatPath(segments: PathSegment[], precision: number): string {
  return segments
    .map(
      (segment) =>
        letterOf(segment) +
        segment.values.map((value) => formatNumber(value, precision, false)).join(' '),
    )
    .join('\n');
}

export function minifyPath(segments: PathSegment[], precision: number): string {
  let out = '';
  let previous: PathSegment | undefined;
  let lastNumber = '';

  for (const segment of segments) {
    const letter = letterOf(segment);
    const sameRun =
      previous?.relative === segment.relative && segment.letter !== 'M' && segment.letter !== 'Z';
    const dropLetter =
      sameRun &&
      (previous?.letter === segment.letter || (previous?.letter === 'M' && segment.letter === 'L'));

    if (!dropLetter) {
      out += letter;
      lastNumber = '';
    }

    for (const value of segment.values) {
      const text = formatNumber(value, precision, true);
      const glue =
        lastNumber !== '' &&
        !text.startsWith('-') &&
        !(text.startsWith('.') && lastNumber.includes('.'));

      out += (glue || (lastNumber === '' && dropLetter) ? ' ' : '') + text;
      lastNumber = text;
    }

    previous = segment;
  }

  return out;
}

type Point = { x: number; y: number };

export function mapValues(
  letter: PathLetter,
  values: number[],
  fx: (n: number) => number,
  fy: (n: number) => number,
) {
  if (letter === 'H') return values.map(fx);
  if (letter === 'V') return values.map(fy);
  if (letter === 'A') {
    return values.map((value, index) => {
      if (index === 5) return fx(value);

      return index === 6 ? fy(value) : value;
    });
  }

  return values.map((value, index) => (index % 2 === 0 ? fx(value) : fy(value)));
}

function endPoint(segment: PathSegment, current: Point, start: Point): Point {
  const v = segment.values;

  if (segment.letter === 'Z') return start;
  if (segment.letter === 'H') return { x: v[0] ?? 0, y: current.y };
  if (segment.letter === 'V') return { x: current.x, y: v[0] ?? 0 };

  return { x: v[v.length - 2] ?? 0, y: v[v.length - 1] ?? 0 };
}

function convert(segments: PathSegment[], relative: boolean): PathSegment[] {
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  return segments.map((segment) => {
    const base = segment.relative ? current : { x: 0, y: 0 };
    const absolute = {
      ...segment,
      values: mapValues(
        segment.letter,
        segment.values,
        (n) => n + base.x,
        (n) => n + base.y,
      ),
    };
    const origin = current;

    current = endPoint(absolute, current, start);
    if (segment.letter === 'M') start = current;
    if (!relative) return { ...absolute, relative: false };

    return {
      ...absolute,
      relative: true,
      values: mapValues(
        segment.letter,
        absolute.values,
        (n) => n - origin.x,
        (n) => n - origin.y,
      ),
    };
  });
}

export const toAbsolute = (segments: PathSegment[]): PathSegment[] => convert(segments, false);
export const toRelative = (segments: PathSegment[]): PathSegment[] => convert(segments, true);
