import type { ToolDefinition, ToolResult } from '@devtoolora/core';
import { describeDuration, parseDuration, type DurationUnit } from '@devtoolora/functions/datetime';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const unitChoices: readonly DurationUnit[] = ['ms', 's', 'm', 'h', 'd'];

function runDurationConverter(fields: Record<string, string>, text: string): ToolResult {
  const unit = choiceField(
    fields.unit,
    's',
    unitChoices,
    'Choose milliseconds, seconds, minutes, hours or days.',
  );
  const breakdown = withToolError(() => describeDuration(parseDuration(text, { unit })));

  return {
    language: 'json',
    summary: `${breakdown.human} · ${breakdown.milliseconds} ms`,
    text: JSON.stringify(breakdown, null, 2),
  };
}

export const durationConverterTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Date & Time',
  description:
    'Convert a duration between milliseconds, clock time, human units and ISO 8601 from tokens like 1h 30m, PT1H30M, 01:30:00 or a bare number.',
  fields: [
    {
      defaultValue: 's',
      help: 'Unit of a bare number such as 90.',
      id: 'unit',
      label: 'Bare number unit',
      options: [
        { label: 'Milliseconds', value: 'ms' },
        { label: 'Seconds', value: 's' },
        { label: 'Minutes', value: 'm' },
        { label: 'Hours', value: 'h' },
        { label: 'Days', value: 'd' },
      ],
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'duration-converter',
  inputKind: 'text',
  inputPresentation: {
    label: 'Duration',
    placeholder: '90m, 1h 30m 15s, PT1H30M, 01:30:00 or a number',
  },
  keywords: [
    'duration',
    'duration converter',
    'iso 8601 duration',
    'time span',
    'seconds to hours',
    'minutes to hours',
    'hh:mm:ss',
    'timedelta',
  ],
  name: 'Duration Converter',
  outputKind: 'json',
  relatedToolIds: ['time-zone-converter', 'timestamp-convert', 'unit-converter', 'cron-explain'],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) => runDurationConverter(fields, text),
  samples: [
    { fields: { unit: 'm' }, label: 'Minutes to everything', text: '90' },
    { fields: { unit: 's' }, label: 'Mixed tokens', text: '1h 30m 15s 250ms' },
    { fields: { unit: 's' }, label: 'ISO 8601 duration', text: 'P1DT2H' },
    { fields: { unit: 's' }, label: 'Clock time', text: '01:30:00.250' },
    { fields: { unit: 'ms' }, label: 'Bare milliseconds', text: '86400000' },
    { fields: { unit: 's' }, label: 'Weeks', text: '2w 3d' },
  ],
  supportsSelection: true,
};
