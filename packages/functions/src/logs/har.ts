import { logError } from './shared';

export type HarEntry = {
  error: string;
  index: number;
  method: string;
  mimeType: string;
  size: number | null;
  started: number | null;
  status: number;
  statusText: string;
  time: number | null;
  type: string;
  url: string;
  wait: number | null;
};

type Rec = Record<string, unknown>;
type StatusClass = '0' | '2xx' | '3xx' | '4xx' | '5xx' | 'other';

const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const rec = (value: unknown): Rec => (isRec(value) ? value : {});
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const nonNeg = (value: unknown): number | null => {
  const n = num(value);

  return n !== null && n >= 0 ? n : null;
};

function mimeSubtype(mimeType: string): string {
  let subtype = (mimeType.split(';')[0] ?? '').split('/')[1]?.trim().toLowerCase() ?? '';

  if (subtype.endsWith('+xml')) subtype = subtype.slice(0, -4);
  else if (subtype.includes('+')) subtype = subtype.slice(subtype.lastIndexOf('+') + 1);

  return subtype.replace(/^x-/, '') || '-';
}

function toEntry(raw: unknown, i: number): HarEntry {
  const entry = rec(raw);
  const request = rec(entry.request);
  const response = rec(entry.response);
  const content = rec(response.content);
  const started =
    typeof entry.startedDateTime === 'string' ? Date.parse(entry.startedDateTime) : NaN;
  const mimeType = str(content.mimeType);

  return {
    // Chromium writes _error on the response; other exporters write it on the entry.
    error: str(response._error) || str(entry._error),
    index: i + 1,
    method: str(request.method),
    mimeType,
    size: nonNeg(content.size) ?? nonNeg(response.bodySize),
    started: Number.isFinite(started) ? started : null,
    status: num(response.status) ?? 0,
    statusText: str(response.statusText),
    time: nonNeg(entry.time),
    type: mimeSubtype(mimeType),
    url: str(request.url),
    wait: nonNeg(rec(entry.timings).wait),
  };
}

export function parseHar(text: string): { entries: HarEntry[]; version: string } {
  if (text.length > 10_485_760) throw logError('HAR input exceeds 10,485,760 characters.');

  const source = text.replace(/^\uFEFF/, '');

  if (source.trim() === '') throw logError('HAR input is empty.');

  let data: unknown;

  try {
    data = JSON.parse(source);
  } catch {
    throw logError('HAR input is not valid JSON.');
  }

  const log = rec(rec(data).log);

  if (!Array.isArray(log.entries)) throw logError('HAR input has no log.entries array.');

  if (log.entries.length > 10_000) throw logError('HAR input exceeds 10,000 entries.');

  return { entries: log.entries.map(toEntry), version: str(log.version) };
}

function statusClass(status: number): StatusClass {
  if (status === 0) return '0';

  if (status >= 200 && status < 600) return `${Math.floor(status / 100)}xx` as StatusClass;

  return 'other';
}

function tally<T>(map: Map<string, T>, key: string, init: () => T): T {
  const existing = map.get(key);

  if (existing) return existing;

  const created = init();

  map.set(key, created);

  return created;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || '-';
  } catch {
    return '-';
  }
}

function top(entries: HarEntry[], pick: (entry: HarEntry) => number | null): HarEntry[] {
  return entries
    .filter((entry) => pick(entry) !== null)
    .sort((a, b) => (pick(b) ?? 0) - (pick(a) ?? 0) || a.index - b.index)
    .slice(0, 5);
}

export function summarizeHar(entries: HarEntry[]): {
  byType: Array<[string, { bytes: number; count: number }]>;
  classes: Record<StatusClass, number>;
  failures: HarEntry[];
  hosts: Array<[string, number]>;
  largest: HarEntry[];
  slowest: HarEntry[];
  spanMs: number | null;
  totalBytes: number;
} {
  const classes: Record<StatusClass, number> = {
    '0': 0,
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };
  const types = new Map<string, { bytes: number; count: number }>();
  const hosts = new Map<string, { count: number }>();
  let totalBytes = 0;
  let first = Infinity;
  let last = -Infinity;

  for (const entry of entries) {
    classes[statusClass(entry.status)] += 1;
    totalBytes += entry.size ?? 0;
    tally(hosts, hostOf(entry.url), () => ({ count: 0 })).count += 1;

    const bucket = tally(types, entry.type, () => ({ bytes: 0, count: 0 }));

    bucket.bytes += entry.size ?? 0;
    bucket.count += 1;

    if (entry.started !== null) {
      first = Math.min(first, entry.started);
      last = Math.max(last, entry.started + (entry.time ?? 0));
    }
  }

  return {
    byType: [...types].sort((a, b) => b[1].bytes - a[1].bytes || a[0].localeCompare(b[0])),
    classes,
    failures: entries.filter((e) => e.status === 0 || e.status >= 400 || e.error !== ''),
    hosts: [...hosts]
      .map(([host, { count }]): [string, number] => [host, count])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    largest: top(entries, (e) => e.size),
    slowest: top(entries, (e) => e.time),
    spanMs: first === Infinity ? null : last - first,
    totalBytes,
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;

  const units = ['kB', 'MB', 'GB'];
  let value = bytes / 1000;
  let unit = 0;

  while (Number(value.toFixed(1)) >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  return `${value.toFixed(1)} ${units[unit]}`;
}

export function shortenUrl(url: string, max = 120): string {
  if (url.length <= max) return url;

  return `${url.slice(0, Math.ceil((max - 1) / 2))}…${url.slice(url.length - Math.floor((max - 1) / 2))}`;
}
