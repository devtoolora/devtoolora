import { ToolDefinition, ToolError } from '@devtoolora/core';
import {
  parseAccessLog,
  summarizeAccessLog,
  type AccessLogEntry,
} from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { numericField } from '../../../adapters/fields';
import { browserSafeCapabilities, flatten, logOutput } from '../shared';

const columns = [
  'Line',
  'IP',
  'Time',
  'Method',
  'Path',
  'Status',
  'Bytes',
  'Referer',
  'User agent',
];
const combined =
  '203.0.113.5 - - [27/Oct/2026:10:48:01 +0000] "GET /index.html HTTP/1.1" 200 5120 "https://example.com/" "Mozilla/5.0 (X11; Linux x86_64)"\n198.51.100.7 - alice [27/Oct/2026:10:48:09 +0200] "POST /api/login HTTP/1.1" 401 87 "-" "curl/8.4.0"';
const common =
  '203.0.113.5 - - [27/Oct/2026:10:48:01 +0000] "GET /index.html HTTP/1.1" 200 5120\n203.0.113.9 - - [27/Oct/2026:10:48:03 +0000] "GET /logo.png HTTP/1.1" 304 -';
const dashBytes =
  '203.0.113.9 - - [27/Oct/2026:10:48:03 +0000] "GET /logo.png HTTP/1.1" 304 - "-" "curl/8.4.0"';
const errorLines =
  '203.0.113.5 - - [27/Oct/2026:10:48:01 +0000] "GET /ok HTTP/1.1" 200 10 "-" "curl/8.4.0"\n203.0.113.5 - - [27/Oct/2026:10:48:02 +0000] "GET /missing HTTP/1.1" 404 0 "-" "curl/8.4.0"\n203.0.113.6 - - [27/Oct/2026:10:48:03 +0000] "GET /boom HTTP/1.1" 500 0 "-" "curl/8.4.0"';
const mixed = `${common}\nthis line is not an access log\n\n-- rotated --`;
const manyPaths = ['/a', '/a', '/a', '/b', '/b', '/c', '/d']
  .map((path, i) => `10.0.0.${i} - - [27/Oct/2026:10:48:0${i} +0000] "GET ${path} HTTP/1.1" 200 1`)
  .join('\n');

const plural = (count: number, noun: string): string =>
  `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
const iso = (time: number): string => new Date(time).toISOString();

const cut = (value: string): string => {
  const chars = [...value];

  return chars.length > 80 ? `${chars.slice(0, 79).join('')}…` : value;
};

const cells = (entry: AccessLogEntry): string[] => [
  String(entry.line),
  entry.ip,
  entry.time === null ? entry.timeText : iso(entry.time),
  entry.method,
  entry.path,
  String(entry.status),
  entry.bytes === null ? '-' : String(entry.bytes),
  entry.referer || '-',
  cut(entry.userAgent || '-'),
];

function summaryReport(
  entries: AccessLogEntry[],
  lines: number,
  unparsed: number[],
  top: number,
): string {
  const s = summarizeAccessLog(entries, top);
  const section = (title: string, counts: Array<[string, number]>): string[] => [
    `${title}:`,
    ...counts.map(([value, count]) => `  ${count}  ${value === '' ? '-' : value}`),
  ];

  return [
    `Lines: ${lines}`,
    `Parsed: ${entries.length}`,
    `Unparsed (first 20 line numbers): ${unparsed.slice(0, 20).join(', ') || '-'}`,
    `Time span: ${s.firstTime === null || s.lastTime === null ? '-' : `${iso(s.firstTime)} → ${iso(s.lastTime)}`}`,
    `Status classes: ${Object.entries(s.classes)
      .map(([name, count]) => `${name} ${count}`)
      .join(', ')}`,
    ...section(`Top statuses`, s.byStatus.slice(0, top)),
    ...section(`Top paths`, s.topPaths),
    ...section(`Top IPs`, s.topIps),
    ...section(`Top user agents`, s.topUserAgents),
    `Methods: ${s.byMethod
      .slice(0, top)
      .map(([name, count]) => `${name} ${count}`)
      .join(', ')}`,
    `Total bytes: ${s.totalBytes}`,
  ].join('\n');
}

export const accessLogParserTool: ToolDefinition = {
  id: 'access-log-parser',
  name: 'Access Log Parser',
  category: 'Logs & Diagnostics',
  description:
    'Parse Apache and nginx common or combined access logs into a table, an errors view or a summary of top paths, IPs, statuses and user agents.',
  samples: [
    { fields: { top: '10', view: 'table' }, label: 'Combined format', text: combined },
    { fields: { top: '10', view: 'table' }, label: 'Common format', text: common },
    { fields: { top: '10', view: 'errors' }, label: 'Only errors', text: errorLines },
    { fields: { top: '10', view: 'table' }, label: 'Unparsed lines mixed in', text: mixed },
    { fields: { top: '3', view: 'summary' }, label: 'Top 3 summary', text: manyPaths },
    { fields: { top: '10', view: 'table' }, label: 'Dash for bytes', text: dashBytes },
  ],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'table',
      id: 'view',
      label: 'View',
      options: [
        { label: 'Table', value: 'table' },
        { label: 'Summary', value: 'summary' },
        { label: 'Errors', value: 'errors' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    { defaultValue: '10', id: 'top', label: 'Top entries', type: 'number' },
  ],
  keywords: ['access log', 'apache', 'nginx', 'combined log format', 'http log', 'status codes'],
  relatedToolIds: [
    'log-filter',
    'json-lines-inspector',
    'log-timestamp-normalizer',
    'user-agent-parser',
  ],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const top = numericField(fields.top, 'Top', 1, 100, 10);

      const { entries, unparsed } = parseAccessLog(text);

      if (entries.length === 0) {
        throw new ToolError('No access log lines in the expected common or combined format.');
      }

      const lines = entries.length + unparsed.length;
      const errors = entries.filter((entry) => entry.status >= 400 && entry.status <= 599);
      const summary = [
        plural(lines, 'line'),
        `${entries.length.toLocaleString('en-US')} parsed`,
        plural(errors.length, 'error'),
      ].join(' · ');

      if (fields.view === 'summary') {
        return {
          ...logOutput(
            summaryReport(entries, lines, unparsed, top),
            'access-log-summary.txt',
            'plaintext',
            summary,
          ),
        };
      }

      const rows = (fields.view === 'errors' ? errors : entries).map(cells);
      const tsv = [columns, ...rows].map((row) => row.map(flatten).join('\t')).join('\n');

      return {
        ...logOutput(tsv, 'access-log.tsv', 'plaintext', summary),
        jsonTable: { columns, presentation: 'plain', rows },
      };
    }),
};
