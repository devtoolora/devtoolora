import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { convertTimeZones } from '@devtoolora/functions/datetime';
import { withToolError } from '../../../adapters/errors';
import { timeZoneOptions } from '../../../adapters/timeZones';

const dayLabels: Record<string, string> = {
  '-1': 'previous day',
  '0': 'same day',
  '1': 'next day',
};
const defaultZones = 'UTC, Europe/Prague, America/New_York, Asia/Tokyo';

function dayLabel(shift: number): string {
  return dayLabels[String(shift)] ?? `${shift > 0 ? '+' : ''}${shift} days`;
}

function runTimeZoneConverter(fields: Record<string, string>, text: string): ToolResult {
  const conversion = withToolError(() =>
    convertTimeZones(text, {
      fromZone: fields.fromZone || 'local',
      zones: (fields.zones ?? defaultZones).split(','),
    }),
  );

  return {
    jsonTable: {
      columns: ['Zone', 'Local time', 'Offset', 'Day'],
      rows: conversion.rows.map((row) => [row.zone, row.local, row.offset, dayLabel(row.dayShift)]),
    },
    language: 'json',
    summary: `${conversion.instant} in ${conversion.rows.length} time zones.`,
    text: JSON.stringify(conversion, null, 2),
  };
}

const sampleFields = { fromZone: 'UTC', zones: defaultZones };

export const timeZoneConverterTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Date & Time',
  description:
    'Convert one date and time to many IANA time zones at once, with local time, UTC offset and day shift for each zone.',
  fields: [
    {
      defaultValue: 'local',
      help: 'Used to read a date-time written without an offset.',
      id: 'fromZone',
      label: 'From time zone',
      options: timeZoneOptions.map((zone) => ({
        label: zone === 'local' ? 'Local (this device)' : zone.replace(/_/g, ' '),
        value: zone,
      })),
      searchable: true,
      type: 'select',
    },
    {
      defaultValue: defaultZones,
      help: 'Comma-separated IANA names, up to 50.',
      id: 'zones',
      label: 'Convert to',
      type: 'text',
    },
  ],
  freshResults: true,
  id: 'time-zone-converter',
  inputKind: 'optionalText',
  inputPresentation: {
    label: 'Date and time',
    placeholder: 'Blank for now, or 2026-10-17T14:00, 2026-10-17T14:00:00+02:00, 1700000000',
  },
  keywords: [
    'time zone',
    'timezone',
    'time zone converter',
    'world clock',
    'meeting planner',
    'utc offset',
    'iana',
    'dst',
  ],
  name: 'Time Zone Converter',
  outputKind: 'json',
  relatedToolIds: ['timestamp-convert', 'cron-explain', 'duration-converter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) => runTimeZoneConverter(fields, text),
  samples: [
    { fields: sampleFields, label: 'Meeting at noon UTC', text: '2026-10-17T12:00' },
    { fields: sampleFields, label: 'Late evening crosses the date line', text: '2026-10-17T23:30' },
    { fields: sampleFields, label: 'Unix timestamp', text: '1700000000' },
    {
      fields: { fromZone: 'UTC', zones: 'Asia/Kolkata, Asia/Kathmandu, Australia/Adelaide' },
      label: 'Half-hour offset zones',
      text: '2026-10-17T12:00',
    },
    { fields: sampleFields, label: 'Date only', text: '2026-10-17' },
    { fields: sampleFields, label: 'Now (blank input)', text: '' },
  ],
  supportsSelection: true,
};
