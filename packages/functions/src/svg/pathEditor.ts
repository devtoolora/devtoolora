import { XmlElement } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { localName } from '../format/xmlElements';
import { formatNumber, formatPath, minifyPath, toAbsolute, toRelative } from './pathFormat';
import { measurePath, type PathBox, type PathPoint } from './pathMeasure';
import { parsePathData, type PathSegment } from './pathParse';
import { scalePath, translatePath } from './pathTransform';
import { assertSafeSvg } from './svgSafety';

export type PathOperation = 'absolute' | 'format' | 'minify' | 'relative' | 'scale' | 'translate';

export type PathEditOptions = {
  display?: 'fill' | 'stroke';
  dx: number;
  dy: number;
  operation: PathOperation;
  precision: number;
  sx: number;
  sy: number;
};

export type PathEdit = {
  bbox: PathBox;
  points: PathPoint[];
  report: string;
  summary: string;
  svg: string;
  text: string;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_OFFSET = 1_000_000;
const TRANSFORM_NOTE = 'Transforms on the path or its ancestors were ignored.';

type FoundPath = { element: XmlElement; transformed: boolean };

function collectPaths(element: XmlElement, transformed: boolean, found: FoundPath[]): void {
  const inherited = transformed || element.attributes.transform !== undefined;

  if (localName(element.name) === 'path') found.push({ element, transformed: inherited });

  for (const child of element.children) {
    if (child instanceof XmlElement) collectPaths(child, inherited, found);
  }
}

function extractPathData(source: string): { d: string; notes: string[] } {
  const trimmed = source.trim();

  if (!trimmed.startsWith('<')) return { d: source, notes: [] };

  const markup = /^<path[\s/>]/.test(trimmed)
    ? `<svg xmlns="${SVG_NAMESPACE}">${trimmed}</svg>`
    : trimmed;
  const found: FoundPath[] = [];
  const root = assertSafeSvg(markup).root;

  if (root) collectPaths(root, false, found);

  const [path] = found;

  if (found.length !== 1 || !path) {
    throw new FunctionError(
      'SVG_PATH_ERROR',
      `Found ${found.length.toLocaleString('en-US')} <path> elements; paste one path or its d attribute.`,
    );
  }

  const d = path.element.attributes.d;

  if (d === undefined || d.trim() === '') {
    throw new FunctionError('SVG_PATH_ERROR', 'The <path> element has no d attribute.');
  }

  return { d, notes: path.transformed ? [TRANSFORM_NOTE] : [] };
}

function assertOffset(value: number, name: string): void {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OFFSET) {
    throw new FunctionError(
      'SVG_PATH_ERROR',
      `${name} must be a number between -1,000,000 and 1,000,000.`,
    );
  }
}

function assertScale(value: number, name: string): void {
  if (!Number.isFinite(value) || Math.abs(value) < 0.001 || Math.abs(value) > 1000) {
    throw new FunctionError(
      'SVG_PATH_ERROR',
      `${name} must be between 0.001 and 1,000 (or -0.001 and -1,000).`,
    );
  }
}

function applyOperation(
  segments: PathSegment[],
  options: PathEditOptions,
): { notes: string[]; segments: PathSegment[] } {
  switch (options.operation) {
    case 'absolute':
      return { notes: [], segments: toAbsolute(segments) };
    case 'relative':
      return { notes: [], segments: toRelative(segments) };
    case 'translate':
      assertOffset(options.dx, 'Offset x');
      assertOffset(options.dy, 'Offset y');

      return { notes: [], segments: translatePath(segments, options.dx, options.dy) };
    case 'scale':
      assertScale(options.sx, 'Scale x');
      assertScale(options.sy, 'Scale y');

      return scalePath(segments, options.sx, options.sy);
    default:
      return { notes: [], segments };
  }
}

function roundPath(segments: PathSegment[], round: (value: number) => number): PathSegment[] {
  const absolute = toAbsolute(segments).map((segment) => ({
    ...segment,
    values: segment.values.map(round),
  }));
  const relative = toRelative(absolute);

  return segments.map((segment, index) => {
    const source = segment.relative ? relative[index] : absolute[index];

    return { ...segment, values: (source ?? segment).values.map(round) };
  });
}

function viewBoxOf(bbox: PathBox, precision: number): string {
  const side = (start: number, size: number): [number, number] =>
    size === 0 ? [start - 0.5, 1] : [start, size];
  const [x, width] = side(bbox.x, bbox.width);
  const [y, height] = side(bbox.y, bbox.height);

  // One decimal at least, so precision 0 keeps the half-unit offset.
  return [x, y, width, height]
    .map((value) => formatNumber(value, Math.max(precision, 1), false))
    .join(' ');
}

const plural = (count: number, noun: string): string =>
  `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;

export function editPath(source: string, options: PathEditOptions): PathEdit {
  const { precision } = options;
  const write = (value: number): string => formatNumber(value, precision, false);
  const round = (value: number): number => Number(write(value));
  const extracted = extractPathData(source);
  const edited = applyOperation(parsePathData(extracted.d), options);
  const rounded = roundPath(edited.segments, round);
  const text =
    options.operation === 'minify'
      ? minifyPath(rounded, precision)
      : formatPath(rounded, precision);
  const measured = measurePath(rounded);
  const bbox = {
    height: round(measured.bbox.height),
    width: round(measured.bbox.width),
    x: round(measured.bbox.x),
    y: round(measured.bbox.y),
  };
  const length = round(measured.length);
  const absolute = toAbsolute(rounded);
  const commands = rounded.map((segment, index) => ({
    index,
    command: formatPath([segment], precision),
    absolute: formatPath(absolute.slice(index, index + 1), precision),
  }));
  const summary = [
    plural(measured.commands, 'command'),
    plural(measured.segments, 'segment'),
    plural(measured.subpaths, 'subpath'),
    `${write(bbox.width)}×${write(bbox.height)} at ${write(bbox.x)},${write(bbox.y)}`,
    `length ${write(length)}`,
  ].join(' · ');
  const notes = [...extracted.notes, ...edited.notes];

  return {
    bbox,
    points: measured.points,
    report: JSON.stringify({ commands, bbox, length }, null, 2),
    summary: notes.length > 0 ? `${summary}. ${notes.join(' ')}` : summary,
    svg: `<svg xmlns="${SVG_NAMESPACE}" viewBox="${viewBoxOf(bbox, precision)}"><path d="${text.replace(/\n/g, ' ')}"${options.display === 'fill' ? '' : ' fill="none" stroke="currentColor"'}/></svg>`,
    text,
  };
}
