import { ToolDefinition, ToolError } from '@devtoolora/core';
import { normalizeLogTimestamps } from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, logOutput } from '../shared';

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

export const logTimestampNormalizerTool: ToolDefinition = {
  id: 'log-timestamp-normalizer',
  name: 'Log Timestamp Normalizer',
  category: 'Logs & Diagnostics',
  description:
    'Rewrite syslog, Apache, ISO 8601, RFC 2822, slashed and Unix timestamps in log lines into one format, in UTC or a time zone of your choice.',
  samples: [
    {
      fields: {
        dateOrder: 'mdy',
        mode: 'replace',
        target: 'iso-utc',
        timeZone: 'UTC',
        year: '2026',
      },
      label: 'Syslog to ISO UTC',
      text: 'Oct 27 10:48:01 host sshd[812]: Accepted publickey for deploy',
    },
    {
      fields: {
        dateOrder: 'mdy',
        mode: 'replace',
        target: 'iso-utc',
        timeZone: 'UTC',
        year: '2026',
      },
      label: 'Apache access log',
      text: '10.0.0.7 - - [27/Oct/2026:10:48:01 +0200] "GET /health HTTP/1.1" 200 2',
    },
    {
      fields: {
        dateOrder: 'mdy',
        mode: 'replace',
        target: 'iso-zone',
        timeZone: 'Europe/Prague',
        year: '2026',
      },
      label: 'Unix time to Prague time',
      text: 'ts=1793090881.5 worker started\n1793090881123 job done',
    },
    {
      fields: {
        dateOrder: 'mdy',
        mode: 'replace',
        target: 'unix-ms',
        timeZone: 'UTC',
        year: '2026',
      },
      label: 'Mixed formats',
      text: 'Oct 27 10:48:01 syslog line\n2026-10-27 10:48:01,123 INFO app\nTue, 27 Oct 2026 10:48:01 +0200 mail\nplain line',
    },
    {
      fields: {
        dateOrder: 'mdy',
        mode: 'prefix',
        target: 'iso-utc',
        timeZone: 'UTC',
        year: '2026',
      },
      label: 'Prefix mode',
      text: 'Oct 27 10:48:01 host cron[4]: job finished',
    },
    {
      fields: {
        dateOrder: 'dmy',
        mode: 'replace',
        target: 'iso-utc',
        timeZone: 'Europe/Prague',
        year: '2026',
      },
      label: 'Slashed day first',
      text: '27/10/2026 10:48:01 request handled',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'iso-utc',
      id: 'target',
      label: 'Output format',
      options: [
        { label: 'ISO 8601 UTC', value: 'iso-utc' },
        { label: 'ISO 8601 in time zone', value: 'iso-zone' },
        { label: 'Unix milliseconds', value: 'unix-ms' },
        { label: 'Unix seconds', value: 'unix-s' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'UTC',
      id: 'timeZone',
      label: 'Time zone',
      placeholder: 'Europe/Prague',
      type: 'text',
    },
    {
      defaultValue: String(new Date().getFullYear()),
      id: 'year',
      label: 'Year for syslog lines',
      type: 'number',
    },
    {
      defaultValue: 'mdy',
      id: 'dateOrder',
      label: 'Slashed date order',
      options: [
        { label: 'Month/Day/Year', value: 'mdy' },
        { label: 'Day/Month/Year', value: 'dmy' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'replace',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Replace', value: 'replace' },
        { label: 'Prefix', value: 'prefix' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: [
    'logs',
    'timestamp',
    'normalize',
    'syslog',
    'apache',
    'unix time',
    'iso 8601',
    'time zone',
  ],
  relatedToolIds: ['timestamp-convert', 'log-filter', 'time-zone-converter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const year = Number(fields.year);

      if (!Number.isInteger(year)) throw new ToolError('Year must be between 1970 and 2100.');

      const result = normalizeLogTimestamps(text, {
        dateOrder: fields.dateOrder === 'dmy' ? 'dmy' : 'mdy',
        mode: fields.mode === 'prefix' ? 'prefix' : 'replace',
        target:
          fields.target === 'iso-zone' || fields.target === 'unix-ms' || fields.target === 'unix-s'
            ? fields.target
            : 'iso-utc',
        timeZone: fields.timeZone?.trim() || 'UTC',
        year,
      });

      return logOutput(
        result.text,
        'normalized.log',
        'plaintext',
        [
          plural(result.normalized + result.unchanged, 'line'),
          `${result.normalized} normalized`,
          `${result.unchanged} unchanged`,
          plural(result.formats.length, 'format'),
        ].join(' · '),
      );
    }),
};
