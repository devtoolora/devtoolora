import { checkLogInput, logError } from './shared';
import { parseApacheTime } from './timestamps';

export type AccessLogEntry = {
  bytes: number | null;
  ip: string;
  line: number;
  method: string;
  path: string;
  protocol: string;
  referer: string;
  status: number;
  time: number | null;
  timeText: string;
  user: string;
  userAgent: string;
};

type Counts = Array<[string, number]>;

const maxLines = 100_000;
const lineRegex =
  /^(\S+) (\S+) (\S+) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d{3}) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?\s*$/;

// Apache writes \" and \\ in quoted fields; other escapes such as \x22 stay as written.
const unescapeQuoted = (value: string | undefined): string =>
  (value ?? '').replace(/\\(["\\])/g, '$1');

function parseLine(raw: string, line: number): AccessLogEntry | undefined {
  const match = lineRegex.exec(raw);

  if (!match) return undefined;

  const request = unescapeQuoted(match[5]);
  const parts = request.split(' ');
  const [method, path, protocol] = parts.length === 3 ? parts : ['-', request, ''];
  const timeText = match[4] ?? '';

  return {
    bytes: match[7] === '-' ? null : Number(match[7]),
    ip: match[1] ?? '',
    line,
    method: method ?? '-',
    path: path ?? '',
    protocol: protocol ?? '',
    referer: unescapeQuoted(match[8]),
    status: Number(match[6]),
    time: parseApacheTime(timeText) ?? null,
    timeText,
    user: match[3] === '-' ? '' : (match[3] ?? ''),
    userAgent: unescapeQuoted(match[9]),
  };
}

export function parseAccessLog(text: string): { entries: AccessLogEntry[]; unparsed: number[] } {
  checkLogInput(text);

  const lines = text.split(/\r\n|\r|\n/);

  if (lines.at(-1) === '') lines.pop();

  if (lines.length > maxLines) throw logError('Log input exceeds 100,000 lines.');

  const entries: AccessLogEntry[] = [];
  const unparsed: number[] = [];

  lines.forEach((raw, index) => {
    if (raw.trim() === '') return;

    const entry = parseLine(raw, index + 1);

    if (entry) entries.push(entry);
    else unparsed.push(index + 1);
  });

  return { entries, unparsed };
}

const compareKeys = (a: string, b: string): number => Number(a > b) - Number(a < b);

function tally(values: Iterable<string>, top?: number): Counts {
  const counts = new Map<string, number>();

  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  const sorted = [...counts].sort((a, b) => b[1] - a[1] || compareKeys(a[0], b[0]));

  return top === undefined ? sorted : sorted.slice(0, top);
}

export function summarizeAccessLog(
  entries: AccessLogEntry[],
  top: number,
): {
  byMethod: Counts;
  byStatus: Counts;
  classes: Record<'1xx' | '2xx' | '3xx' | '4xx' | '5xx', number>;
  errors: number;
  firstTime: number | null;
  lastTime: number | null;
  topIps: Counts;
  topPaths: Counts;
  topUserAgents: Counts;
  totalBytes: number;
} {
  if (!Number.isInteger(top) || top < 1 || top > 100) {
    throw logError('Top must be between 1 and 100.');
  }

  const classes = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  const times = entries.flatMap((entry) => (entry.time === null ? [] : [entry.time]));

  for (const { status } of entries) {
    const key = `${Math.floor(status / 100)}xx`;

    if (key === '1xx' || key === '2xx' || key === '3xx' || key === '4xx' || key === '5xx') {
      classes[key] += 1;
    }
  }

  return {
    byMethod: tally(entries.map((entry) => entry.method)),
    byStatus: tally(entries.map((entry) => String(entry.status))),
    classes,
    errors: classes['4xx'] + classes['5xx'],
    firstTime: times.length > 0 ? times.reduce((a, b) => Math.min(a, b)) : null,
    lastTime: times.length > 0 ? times.reduce((a, b) => Math.max(a, b)) : null,
    topIps: tally(
      entries.map((entry) => entry.ip),
      top,
    ),
    topPaths: tally(
      entries.map((entry) => entry.path),
      top,
    ),
    topUserAgents: tally(
      entries.map((entry) => entry.userAgent),
      top,
    ),
    totalBytes: entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
  };
}
