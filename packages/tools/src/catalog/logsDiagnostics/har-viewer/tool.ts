import { ToolDefinition, ToolError } from '@devtoolora/core';
import { parseDataUri } from '@devtoolora/functions/binary';
import {
  formatSize,
  parseHar,
  shortenUrl,
  summarizeHar,
  type HarEntry,
} from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, flatten, logOutput } from '../shared';

const maxBytes = 10 * 1024 * 1024;
const tableColumns = ['#', 'Method', 'Status', 'URL', 'Type', 'Size', 'Time', 'Wait'];
const failureColumns = ['#', 'Method', 'Status', 'URL', 'Error'];

const har = (entries: unknown[]): string => JSON.stringify({ log: { entries, version: '1.2' } });
const entry = (
  method: string,
  url: string,
  status: number,
  mimeType: string,
  size: number,
  time: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  request: { method, url },
  response: { content: { mimeType, size }, status, statusText: status === 200 ? 'OK' : 'Error' },
  startedDateTime: '2026-10-27T10:00:00.000Z',
  time,
  timings: { wait: Math.round(time / 2) },
  ...extra,
});

const basic = har([
  entry('GET', 'https://example.com/index.html', 200, 'text/html', 1024, 120),
  entry('GET', 'https://example.com/app.js', 200, 'application/javascript', 52_000, 340),
  entry('POST', 'https://api.example.com/items', 404, 'application/json', 87, 210),
]);
const withFailures = har([
  entry('GET', 'https://example.com/ok', 200, 'text/html', 900, 80),
  entry('GET', 'https://example.com/boom', 500, 'text/plain', 12, 400),
  entry('GET', 'https://cdn.example.com/lib.js', 0, 'application/javascript', 0, 30, {
    _error: 'net::ERR_CONNECTION_REFUSED',
  }),
]);
const malformed = har([
  {
    request: { method: 'GET', url: 'https://example.com/a' },
    response: { status: 200 },
    time: '5',
  },
  {},
]);
const minimal = har([entry('GET', 'https://example.com/', 200, 'text/html', 512, 45)]);

const plural = (count: number, noun: string): string =>
  `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
const ms = (value: number | null): string => (value === null ? '-' : `${Math.round(value)} ms`);

const span = (value: number | null): string => {
  if (value === null) return '-';

  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
};

const orDash = (value: string): string => (value === '' ? '-' : value);
const maxHosts = 10;
const request = (e: HarEntry): string => `${e.method} ${shortenUrl(e.url)}`.trim() || '-';

function harSource(text: string, fileData: string | undefined): string {
  if (!fileData?.trim()) return text;

  try {
    const { bytes } = parseDataUri(fileData);

    if (bytes.length > maxBytes) throw new ToolError('HAR file must be no larger than 10 MiB.');

    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    if (error instanceof ToolError) throw error;

    throw new ToolError('HAR file data is invalid.');
  }
}

const tableCells = (e: HarEntry): string[] => [
  String(e.index),
  orDash(e.method),
  String(e.status),
  shortenUrl(orDash(e.url)),
  e.type,
  e.size === null ? '-' : formatSize(e.size),
  ms(e.time),
  ms(e.wait),
];
const failureCells = (e: HarEntry): string[] => [
  String(e.index),
  orDash(e.method),
  String(e.status),
  shortenUrl(orDash(e.url)),
  orDash(e.error || e.statusText),
];

function summaryReport(entries: HarEntry[], version: string): string {
  const s = summarizeHar(entries);
  const line = (value: string, label: string): string => `  ${value}  ${label}`;

  return [
    `Requests: ${entries.length}${version ? ` (HAR ${version})` : ''}`,
    `Content size: ${formatSize(s.totalBytes)}`,
    `Span: ${span(s.spanMs)}`,
    `Status classes: ${Object.entries(s.classes)
      .map(([name, count]) => `${name} ${count}`)
      .join(', ')}`,
    'By type:',
    ...s.byType.map(([type, { bytes, count }]) => line(formatSize(bytes), `${type} (${count})`)),
    'Hosts:',
    ...s.hosts.slice(0, maxHosts).map(([host, count]) => line(String(count), host)),
    ...(s.hosts.length > maxHosts
      ? [
          `  … and ${s.hosts.length - maxHosts} more host${s.hosts.length - maxHosts === 1 ? '' : 's'}`,
        ]
      : []),
    'Slowest 5:',
    ...s.slowest.map((e) => line(ms(e.time), request(e))),
    'Largest 5:',
    ...s.largest.map((e) => line(formatSize(e.size ?? 0), request(e))),
  ].join('\n');
}

export const harViewerTool: ToolDefinition = {
  id: 'har-viewer',
  name: 'HAR Viewer',
  category: 'Logs & Diagnostics',
  description:
    'Open a HAR network capture and see requests as a table, a summary by type, host and status class, or only the failures. Runs locally.',
  samples: [
    { fields: { view: 'table' }, label: 'Three requests', text: basic },
    { fields: { view: 'table' }, label: 'With a failed request', text: withFailures },
    { fields: { view: 'table' }, label: 'Malformed fields', text: malformed },
    { fields: { view: 'failures' }, label: 'Failures only', text: withFailures },
    { fields: { view: 'summary' }, label: 'Summary', text: basic },
    { fields: { view: 'table' }, label: 'Minimal HAR', text: minimal },
  ],
  inputKind: 'optionalText',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  sensitiveInput: true,
  runRequires: [{ anyOf: ['$text', 'file'] }],
  fields: [
    {
      accept: '.har,application/json',
      id: 'file',
      label: 'Local HAR file (takes precedence over text)',
      maxBytes,
      type: 'file',
    },
    {
      defaultValue: 'table',
      id: 'view',
      label: 'View',
      options: [
        { label: 'Table', value: 'table' },
        { label: 'Summary', value: 'summary' },
        { label: 'Failures', value: 'failures' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: ['har', 'network capture', 'devtools', 'http archive', 'requests', 'waterfall'],
  relatedToolIds: ['http-status', 'user-agent-parser', 'json-lines-inspector'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const { entries, version } = parseHar(harSource(text, fields.file));
      const s = summarizeHar(entries);
      const summary = [
        plural(entries.length, 'request'),
        formatSize(s.totalBytes),
        plural(s.failures.length, 'failure'),
        span(s.spanMs),
      ].join(' · ');

      if (fields.view === 'summary') {
        return logOutput(summaryReport(entries, version), 'har-summary.txt', 'plaintext', summary);
      }

      const failures = fields.view === 'failures';
      const columns = failures ? failureColumns : tableColumns;
      const rows = (failures ? s.failures : entries).map(failures ? failureCells : tableCells);
      const tsv = [columns, ...rows].map((row) => row.map(flatten).join('\t')).join('\n');

      return {
        ...logOutput(tsv, 'har-entries.tsv', 'plaintext', summary),
        jsonTable: { columns, presentation: 'plain', rows },
      };
    }),
};
