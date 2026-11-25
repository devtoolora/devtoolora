import { logError } from './shared';
import { readSourceMaps, scanSegments, type MappingSegment, type SourceMapData } from './sourceMap';

export interface SourceMapReport {
  frames: Array<{
    generated: { column: number; file: string; line: number };
    input: string;
    original: {
      column: number;
      line: number;
      nameAtPosition: string | null;
      source: string;
    } | null;
    reason?: 'no map' | 'unmapped';
  }>;
  maps: Array<{ file: string; name: string; sources: number }>;
}

export interface ResolvedTrace {
  report: SourceMapReport;
  summary: string;
  trace: string;
}

interface Frame {
  column: number;
  eol: string;
  file: string;
  indent: string;
  index: number;
  kind: 'spidermonkey' | 'v8';
  line: number;
  name: string;
  text: string;
}

interface Hit {
  column: number;
  content: string | null;
  line: number;
  name: string | null;
  source: string;
}

interface Counts {
  noContent: number;
  noMap: Set<string>;
  noMapCount: number;
  resolved: number;
  unmapped: number;
}

type Lookup = Map<string, SourceMapData>;

const MAX_TRACE = 1_048_576;
const MAX_FRAMES = 5_000;
const MAX_OUTPUT = 5_000_000;
const MAX_CODE = 300;
const MAX_DIGITS = 9;

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

function readNumber(text: string, end: number): { start: number; value: number } | null {
  let start = end;

  while (start > 0 && isDigit(text.charCodeAt(start - 1))) start -= 1;

  if (start === end || end - start > MAX_DIGITS || text[start - 1] !== ':') return null;

  return { start: start - 1, value: Number(text.slice(start, end)) };
}

function parseLocation(text: string): { column: number; file: string; line: number } | null {
  const column = readNumber(text, text.length);
  const line = column ? readNumber(text, column.start) : null;

  if (!column || !line || line.start === 0) return null;

  return { column: column.value, file: text.slice(0, line.start), line: line.value };
}

function parseFrame(raw: string, index: number): Frame | null {
  const eol = raw.endsWith('\r') ? '\r' : '';
  const body = eol === '' ? raw : raw.slice(0, -1);
  const text = body.trim();
  const indent = body.slice(0, body.length - body.trimStart().length);
  const base = { eol, indent, index, text };

  if (text.startsWith('at ')) {
    const rest = text.slice(3);
    const open = rest.endsWith(')') ? rest.indexOf(' (') : -1;
    const location = parseLocation(open < 0 ? rest : rest.slice(open + 2, -1));
    const name = open < 0 ? '' : rest.slice(0, open);

    return location && { ...base, ...location, kind: 'v8', name };
  }

  const at = text.lastIndexOf('@');
  const location = at < 0 ? null : parseLocation(text.slice(at + 1));

  return location && { ...base, ...location, kind: 'spidermonkey', name: text.slice(0, at) };
}

function collectFrames(lines: string[]): Frame[] {
  const frames: Frame[] = [];

  lines.forEach((line, index) => {
    const frame = parseFrame(line, index);

    if (!frame) return;

    frames.push(frame);

    if (frames.length > MAX_FRAMES) {
      throw logError('The stack trace has more than 5,000 frame lines.');
    }
  });

  if (frames.length === 0) {
    throw logError('No stack frames with :line:column locations were found.');
  }

  return frames;
}

function basename(location: string): string {
  const hash = location.indexOf('#');
  const noHash = hash < 0 ? location : location.slice(0, hash);
  const query = noHash.indexOf('?');
  const path = query < 0 ? noHash : noHash.slice(0, query);

  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

function buildLookup(maps: SourceMapData[]): Lookup {
  const lookup: Lookup = new Map();

  for (const map of maps) {
    const stem = map.name.endsWith('.map') ? map.name.slice(0, -4) : map.name;

    for (const key of [basename(map.file), basename(stem)]) {
      if (key !== '' && !lookup.has(key)) lookup.set(key, map);
    }
  }

  return lookup;
}

function pairByPosition(frames: Frame[], maps: SourceMapData[], lookup: Lookup): string {
  const names = new Set(frames.map((frame) => basename(frame.file)));
  const [only] = [...names];
  const [map] = maps;

  if (maps.length !== 1 || names.size !== 1 || !map || only === undefined || lookup.has(only)) {
    return '';
  }

  lookup.set(only, map);

  return ` · paired ${map.name} with ${only} by position`;
}

function scanMaps(
  frames: Frame[],
  lookup: Lookup,
): Map<SourceMapData, Map<number, MappingSegment[]>> {
  const wanted = new Map<SourceMapData, Set<number>>();

  for (const frame of frames) {
    const map = lookup.get(basename(frame.file));

    if (map) wanted.set(map, (wanted.get(map) ?? new Set<number>()).add(frame.line - 1));
  }

  const scanned = new Map<SourceMapData, Map<number, MappingSegment[]>>();

  for (const [map, lines] of wanted) scanned.set(map, scanSegments(map, lines));

  return scanned;
}

function pickSegment(segments: MappingSegment[], column: number): MappingSegment | null {
  let best: MappingSegment | null = null;

  for (const segment of segments) {
    if (segment.column <= column && (best === null || segment.column >= best.column)) {
      best = segment;
    }
  }

  return best;
}

function lookupFrame(
  map: SourceMapData,
  segments: Map<number, MappingSegment[]>,
  frame: Frame,
): Hit | null {
  const segment = pickSegment(segments.get(frame.line - 1) ?? [], frame.column - 1);
  const { source, sourceColumn, sourceLine } = segment ?? {};

  if (!segment || source === undefined || sourceLine === undefined || sourceColumn === undefined) {
    return null;
  }

  const sourceName = map.sources[source];

  if (typeof sourceName !== 'string') return null;

  return {
    column: sourceColumn + 1,
    content: map.sourcesContent?.[source] ?? null,
    line: sourceLine + 1,
    name: segment.name === undefined ? null : (map.names[segment.name] ?? null),
    source: sourceName,
  };
}

function resolveFrames(frames: Frame[], lookup: Lookup, context: boolean) {
  const scanned = scanMaps(frames, lookup);
  const hits = new Map<number, Hit>();
  const entries: SourceMapReport['frames'] = [];
  const counts: Counts = {
    noContent: 0,
    noMap: new Set(),
    noMapCount: 0,
    resolved: 0,
    unmapped: 0,
  };

  for (const frame of frames) {
    const map = lookup.get(basename(frame.file));
    const hit = map ? lookupFrame(map, scanned.get(map) ?? new Map(), frame) : null;
    const entry: SourceMapReport['frames'][number] = {
      generated: { column: frame.column, file: frame.file, line: frame.line },
      input: frame.text,
      original: hit && {
        column: hit.column,
        line: hit.line,
        nameAtPosition: hit.name,
        source: hit.source,
      },
    };

    if (hit) {
      counts.resolved += 1;
      hits.set(frame.index, hit);
      if (context && hit.content === null) counts.noContent += 1;
    } else if (map) {
      entry.reason = 'unmapped';
      counts.unmapped += 1;
    } else {
      entry.reason = 'no map';
      counts.noMapCount += 1;
      counts.noMap.add(basename(frame.file));
    }

    entries.push(entry);
  }

  return { counts, entries, hits };
}

// The frame keeps its own name: a mapped name is the identifier at the position, usually the
// function called there, so printing it would label each frame with the name from the frame above.
function rewrite(frame: Frame, hit: Hit): string {
  const { name } = frame;
  const location = `${hit.source}:${hit.line}:${hit.column}`;

  if (frame.kind === 'spidermonkey') return `${frame.indent}${name}@${location}${frame.eol}`;

  return `${frame.indent}at ${name === '' ? location : `${name} (${location})`}${frame.eol}`;
}

function contextLines(frame: Frame, hit: Hit, content: string): string[] {
  const rows = content.split('\n');

  if (rows[rows.length - 1] === '') rows.pop();

  const last = Math.min(rows.length, hit.line + 2);
  const width = String(last).length;
  const result: string[] = [];

  for (let number = Math.max(1, hit.line - 2); number <= last; number += 1) {
    const raw = (rows[number - 1] ?? '').replace(/\r$/, '');
    const code = raw.length > MAX_CODE ? `${raw.slice(0, MAX_CODE - 1)}…` : raw;
    const mark = number === hit.line ? '>' : ' ';

    result.push(`${frame.indent}${mark} ${String(number).padStart(width)} | ${code}${frame.eol}`);
  }

  return result;
}

function buildTrace(
  lines: string[],
  frames: Frame[],
  hits: Map<number, Hit>,
  context: boolean,
): string {
  const frameAt = new Map(frames.map((frame) => [frame.index, frame]));
  const out: string[] = [];
  let size = 0;

  const add = (line: string): void => {
    size += line.length + (out.length > 0 ? 1 : 0);

    if (size > MAX_OUTPUT) {
      throw logError('The resolved output is longer than 5,000,000 characters.');
    }

    out.push(line);
  };

  lines.forEach((line, index) => {
    const frame = frameAt.get(index);
    const hit = hits.get(index);

    add(frame && hit ? rewrite(frame, hit) : line);

    if (context && frame && hit?.content) contextLines(frame, hit, hit.content).forEach(add);
  });

  return out.join('\n');
}

function summarize(counts: Counts, total: number, paired: string, context: boolean): string {
  const shown = [...counts.noMap].slice(0, 3).join(', ');
  const names = counts.noMap.size > 3 ? `${shown}, …` : shown;
  const noMap = counts.noMapCount > 0 ? ` · ${counts.noMapCount} without a map (${names})` : '';
  const unmapped = counts.unmapped > 0 ? ` · ${counts.unmapped} unmapped` : '';
  const content =
    context && counts.noContent > 0 ? ` · ${counts.noContent} without source content` : '';

  return `Resolved ${counts.resolved} of ${total} frames${noMap}${unmapped}${paired}${content}.`;
}

export function resolveStackTrace(
  text: string,
  files: Array<{ bytes: Uint8Array; name: string }>,
  options: { context: boolean },
): ResolvedTrace {
  if (text.length > MAX_TRACE)
    throw logError('The stack trace is limited to 1,048,576 characters.');

  const lines = text.split('\n');
  const frames = collectFrames(lines);
  const maps = readSourceMaps(files);
  const lookup = buildLookup(maps);
  const paired = pairByPosition(frames, maps, lookup);
  const { counts, entries, hits } = resolveFrames(frames, lookup, options.context);
  const trace = buildTrace(lines, frames, hits, options.context);
  const report: SourceMapReport = {
    frames: entries,
    maps: maps.map((map) => ({ file: map.file, name: map.name, sources: map.sources.length })),
  };

  return { report, summary: summarize(counts, frames.length, paired, options.context), trace };
}
