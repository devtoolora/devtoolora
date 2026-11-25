import { logError } from './shared';

export interface MappingSegment {
  column: number;
  name?: number;
  source?: number;
  sourceColumn?: number;
  sourceLine?: number;
}

export interface SourceMapData {
  file: string;
  mappings: string;
  name: string;
  names: Array<string | null>;
  sourceRoot: string;
  sources: Array<string | null>;
  sourcesContent: Array<string | null> | null;
}

const MAX_FILES = 20;
const MAX_FILE_BYTES = 50 * 1_048_576;
const MAX_TOTAL_BYTES = 100 * 1_048_576;
const MAX_ENTRIES = 100_000;
const MAX_SEGMENTS = 10_000_000;
const MAX_VALUE = 2_147_483_647;
const MAX_DIGITS = 7;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGITS = new Int8Array(128).fill(-1);

for (let index = 0; index < BASE64.length; index += 1) {
  DIGITS[BASE64.charCodeAt(index)] = index;
}

function digitAt(segment: string, index: number): number {
  const code = segment.charCodeAt(index);

  return code < 128 ? (DIGITS[code] ?? -1) : -1;
}

export function decodeVlqSegment(segment: string, offset: number, fileName: string): number[] {
  const values: number[] = [];
  let raw = 0;
  let multiplier = 1;
  let digitCount = 0;
  let start = 0;

  for (let index = 0; index < segment.length; index += 1) {
    const digit = digitAt(segment, index);

    if (digit < 0)
      throw logError(`${fileName}: invalid mapping character at offset ${offset + index}.`);

    if (digitCount === 0) start = index;

    digitCount += 1;

    if (digitCount > MAX_DIGITS) {
      throw logError(
        `${fileName}: a mapping value has more than 7 digits at offset ${offset + start}.`,
      );
    }

    raw += (digit % 32) * multiplier;
    multiplier *= 32;

    if (digit < 32) {
      const magnitude = Math.floor(raw / 2);

      if (magnitude > MAX_VALUE) {
        throw logError(
          `${fileName}: a mapping value exceeds 2,147,483,647 at offset ${offset + start}.`,
        );
      }

      values.push(raw % 2 === 1 ? 0 - magnitude : magnitude);
      raw = 0;
      multiplier = 1;
      digitCount = 0;
    }
  }

  if (digitCount > 0) {
    throw logError(
      `${fileName}: invalid mapping character at offset ${offset + segment.length - 1}.`,
    );
  }

  return values;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function stringList(value: unknown, name: string): Array<string | null> {
  if (value === undefined) return [];

  if (!Array.isArray(value) || !value.every(isStringOrNull)) {
    throw logError(`${name}: sources and names must be arrays of strings or null.`);
  }

  return value;
}

function parseJson(bytes: Uint8Array, name: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw logError(`${name} is not valid JSON.`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw logError(`${name} is not valid JSON.`);
  }

  return Object.fromEntries(Object.entries(parsed));
}

function parseSourceMap(bytes: Uint8Array, name: string): SourceMapData {
  const json = parseJson(bytes, name);

  if (json.version !== 3) throw logError(`${name}: version must be 3.`);

  if (Object.hasOwn(json, 'sections'))
    throw logError('Index source maps (sections) are not supported.');

  if (typeof json.mappings !== 'string') throw logError(`${name}: mappings must be a string.`);

  const sources = stringList(json.sources, name);
  const names = stringList(json.names, name);

  if (sources.length > MAX_ENTRIES || names.length > MAX_ENTRIES) {
    throw logError(`${name} has more than 100,000 sources or names.`);
  }

  const root = typeof json.sourceRoot === 'string' ? json.sourceRoot : '';
  const prefix = root === '' || root.endsWith('/') ? root : `${root}/`;
  const content = Array.isArray(json.sourcesContent)
    ? json.sourcesContent.map((item: unknown) => (typeof item === 'string' ? item : null))
    : null;

  if (content && content.length > sources.length) {
    throw logError(`${name}: sourcesContent has more entries than sources.`);
  }

  return {
    file: typeof json.file === 'string' ? json.file : '',
    mappings: json.mappings,
    name,
    names,
    sourceRoot: root,
    sources: sources.map((source) => (source === null ? null : prefix + source)),
    sourcesContent: content,
  };
}

export function readSourceMaps(files: Array<{ bytes: Uint8Array; name: string }>): SourceMapData[] {
  if (files.length < 1 || files.length > MAX_FILES) throw logError('Add 1 to 20 source map files.');

  let total = 0;

  for (const { bytes, name } of files) {
    if (bytes.length > MAX_FILE_BYTES) throw logError(`${name} is larger than 50 MiB.`);

    total += bytes.length;
  }

  if (total > MAX_TOTAL_BYTES) throw logError('Source maps are limited to 100 MiB in total.');

  return files.map(({ bytes, name }) => parseSourceMap(bytes, name));
}

interface ScanState {
  column: number;
  name: number;
  source: number;
  sourceColumn: number;
  sourceLine: number;
}

function applySegment(
  state: ScanState,
  fields: number[],
  line: number,
  fileName: string,
): MappingSegment {
  if (fields.length !== 1 && fields.length !== 4 && fields.length !== 5) {
    throw logError(
      `${fileName}: generated line ${line + 1} has a segment with ${fields.length} fields.`,
    );
  }

  state.column += fields[0] ?? 0;

  const segment: MappingSegment = { column: state.column };

  if (fields.length >= 4) {
    state.source += fields[1] ?? 0;
    state.sourceLine += fields[2] ?? 0;
    state.sourceColumn += fields[3] ?? 0;
    segment.source = state.source;
    segment.sourceLine = state.sourceLine;
    segment.sourceColumn = state.sourceColumn;
  }

  if (fields.length === 5) {
    state.name += fields[4] ?? 0;
    segment.name = state.name;
  }

  const values = [
    segment.column,
    segment.source ?? 0,
    segment.sourceLine ?? 0,
    segment.sourceColumn ?? 0,
    segment.name ?? 0,
  ];

  if (values.some((value) => value < 0)) {
    throw logError(
      `${fileName}: generated line ${line + 1} has a negative source index, line or column.`,
    );
  }

  return segment;
}

export function scanSegments(
  map: SourceMapData,
  lines: ReadonlySet<number>,
): Map<number, MappingSegment[]> {
  const result = new Map<number, MappingSegment[]>();
  let lastLine = -1;

  for (const wanted of lines) lastLine = Math.max(lastLine, wanted);

  const { mappings } = map;
  const state: ScanState = { column: 0, name: 0, source: 0, sourceColumn: 0, sourceLine: 0 };
  let line = 0;
  let count = 0;
  let position = 0;

  while (lastLine >= 0 && line <= lastLine && position <= mappings.length) {
    let end = position;

    while (end < mappings.length && mappings[end] !== ',' && mappings[end] !== ';') end += 1;

    if (end > position) {
      count += 1;

      if (count > MAX_SEGMENTS)
        throw logError(`${map.name} has more than 10,000,000 mapping segments.`);

      const fields = decodeVlqSegment(mappings.slice(position, end), position, map.name);
      const segment = applySegment(state, fields, line, map.name);

      if (lines.has(line)) {
        const list = result.get(line) ?? [];

        list.push(segment);
        result.set(line, list);
      }
    }

    if (mappings[end] === ';') {
      line += 1;
      state.column = 0;
    }

    position = end + 1;
  }

  return result;
}
