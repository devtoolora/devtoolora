import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { processJsonDocument } from '@devtoolora/functions/format';
import * as webFunctions from '@devtoolora/functions/web';
import type { TimestampUnit } from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { timeZoneOptions } from '../../../adapters/timeZones';
import { browserSafeCapabilities } from '../shared';

export const timestampConvertTool: ToolDefinition = {
  id: 'timestamp-convert',
  name: 'Timestamp Converter',
  category: 'Date & Time',
  description:
    'Convert Unix seconds, milliseconds, microseconds or nanoseconds and ISO 8601 or HTTP dates to UTC, any time zone, RFC 2822, relative time and ISO week, for one value or a whole column.',
  samples: [
    { fields: { timeZone: 'UTC', unit: 'auto' }, label: 'Unix seconds', text: '1700000000' },
    {
      fields: { timeZone: 'Europe/Prague', unit: 'auto' },
      label: 'Milliseconds from Date.now()',
      text: '1760000000000',
    },
    {
      fields: { timeZone: 'America/New_York', unit: 'auto' },
      label: 'ISO date-time with offset',
      text: '2026-06-02T10:00:00+02:00',
    },
    {
      fields: { timeZone: 'Europe/Prague', unit: 'auto' },
      label: 'Local time on a DST change',
      text: '2026-03-29T02:30',
    },
    {
      fields: { timeZone: 'Asia/Tokyo', unit: 'auto' },
      label: 'HTTP date header',
      text: 'Tue, 02 Jun 2026 10:00:00 GMT',
    },
    {
      fields: { timeZone: 'UTC', unit: 'auto' },
      label: 'Log column as a table',
      text: '1700000000\n1700003600000\n2026-01-01T00:00:00Z\n1767225600000000',
    },
  ],
  inputKind: 'optionalText',
  inputPresentation: {
    label: 'Timestamps or dates',
    placeholder:
      'Blank for now, or 1700000000, 1700000000000, 2026-06-02T10:00:00+02:00; one per line',
  },
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  fields: [
    {
      defaultValue: 'local',
      help: 'Used for local time and for reading dates written without an offset.',
      id: 'timeZone',
      label: 'Time zone',
      options: timeZoneOptions.map((zone) => ({
        label: zone === 'local' ? 'Local (this device)' : zone.replace(/_/g, ' '),
        value: zone,
      })),
      searchable: true,
      type: 'select',
    },
    {
      defaultValue: 'auto',
      help: 'Auto reads up to 11 digits as seconds, 12–14 as milliseconds, 15–17 as microseconds and more as nanoseconds.',
      id: 'unit',
      label: 'Unit',
      options: [
        { label: 'Auto', value: 'auto' },
        { label: 'Seconds', value: 's' },
        { label: 'Milliseconds', value: 'ms' },
        { label: 'Microseconds', value: 'us' },
        { label: 'Nanoseconds', value: 'ns' },
      ],
      type: 'select',
    },
  ],
  keywords: [
    'timestamp',
    'unix time',
    'epoch',
    'epoch converter',
    'unix timestamp converter',
    'date converter',
    'iso 8601',
    'rfc 2822',
    'time zone',
    'milliseconds',
    'iso week',
  ],
  relatedToolIds: ['jwt-parse', 'cron-explain', 'raw-log-redactor'],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ text, fields }) => timestampConvert(text.trim() ? text : (fields.value ?? ''), fields),
};

function timestampConvert(text: string, fields: Record<string, string>): ToolResult {
  const unit = fields.unit || 'auto';

  if (!['auto', 's', 'ms', 'us', 'ns'].includes(unit))
    throw new ToolError('Choose Auto, seconds, milliseconds, microseconds or nanoseconds.');

  const options = { timeZone: fields.timeZone || 'local', unit: unit as TimestampUnit };
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1000) throw new ToolError('Convert at most 1,000 lines at once.');

  if (lines.length <= 1) {
    const report = withToolError(() => webFunctions.convertTimestamp(lines[0] ?? '', options));
    const output = JSON.stringify(report, null, 2);

    return {
      jsonTree: {
        expandedLevels: 2,
        nodes: processJsonDocument(output, { collectTree: true, mode: 'minify' }).nodes,
      },
      language: 'json',
      summary: `${report.detected} · ${report.local} in ${report.timeZone} · ${report.relative}.`,
      text: output,
    };
  }

  return convertTimestampLines(lines, options);
}

function convertTimestampLines(
  lines: string[],
  options: { timeZone: string; unit: TimestampUnit },
): ToolResult {
  const zone = withToolError(() => webFunctions.resolveTimeZone(options.timeZone));
  const rows = lines.map((line) => {
    try {
      const report = webFunctions.convertTimestamp(line, options);

      return {
        input: line,
        iso: report.iso,
        local: report.local,
        unixSeconds: report.unixSeconds,
        unixMilliseconds: report.unixMilliseconds,
        relative: report.relative,
        detected: report.detected,
      };
    } catch (error) {
      return { input: line, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const failed = rows.filter((row) => 'error' in row).length;
  const columns = [
    'input',
    'iso',
    'local',
    'unixSeconds',
    'unixMilliseconds',
    'relative',
    'detected',
    ...(failed ? ['error'] : []),
  ];

  return {
    jsonTable: {
      columns,
      presentation: 'plain',
      rows: rows.map((row) =>
        columns.map((column) => {
          const value = (row as Record<string, unknown>)[column];

          return value === undefined ? null : String(value);
        }),
      ),
    },
    language: 'json',
    summary: `${rows.length - failed} of ${rows.length} values converted · local time in ${zone}${failed ? ` · ${failed} could not be read` : ''}.`,
    text: JSON.stringify(rows, null, 2),
  };
}
