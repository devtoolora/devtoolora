import type { ToolDefinition, ToolResult } from '@devtoolora/core';
import { addToDate, dateDifference, dateInfo, todayDate } from '@devtoolora/functions/datetime';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const modes = ['difference', 'add', 'info'] as const;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${Math.abs(count) === 1 ? '' : 's'}`;
}

function runDateCalculator(fields: Record<string, string>, text: string): ToolResult {
  const mode = choiceField(fields.mode, 'difference', modes, 'Choose a calculator mode.');
  const start = text.trim() || todayDate();

  return withToolError(() => {
    if (mode === 'add') {
      const date = addToDate(start, fields.amount ?? '+1m');

      return { language: 'json', summary: date, text: JSON.stringify({ date }, null, 2) };
    }

    if (mode === 'info') {
      const info = dateInfo(start);

      return {
        language: 'json',
        summary: `${info.weekday}, ${info.isoWeek}`,
        text: JSON.stringify(info, null, 2),
      };
    }

    const diff = dateDifference(start, fields.end?.trim() || todayDate());

    return {
      language: 'json',
      summary: plural(diff.days, 'day'),
      text: JSON.stringify(diff, null, 2),
    };
  });
}

export const dateCalculatorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Date & Time',
  description:
    'Count days, weeks and business days between two dates, add or subtract years, months, weeks and days, or look up the weekday and ISO week of a date.',
  fields: [
    {
      defaultValue: 'difference',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Difference', value: 'difference' },
        { label: 'Add or subtract', value: 'add' },
        { label: 'Date info', value: 'info' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      id: 'end',
      label: 'End date',
      placeholder: 'YYYY-MM-DD, blank for today',
      type: 'text',
      visibleWhen: { field: 'mode', is: ['difference'] },
    },
    {
      defaultValue: '+1m',
      help: 'e.g. +1y 2m 3w 4d, -10d or +5bd',
      id: 'amount',
      label: 'Amount',
      type: 'text',
      visibleWhen: { field: 'mode', is: ['add'] },
    },
  ],
  freshResults: true,
  id: 'date-calculator',
  inputKind: 'optionalText',
  inputPresentation: { label: 'Start date', placeholder: 'YYYY-MM-DD, blank for today' },
  keywords: [
    'date calculator',
    'days between dates',
    'add days to date',
    'business days',
    'working days',
    'iso week',
    'day of year',
    'date difference',
  ],
  name: 'Date Calculator',
  outputKind: 'json',
  relatedToolIds: ['duration-converter', 'timestamp-convert', 'time-zone-converter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) => runDateCalculator(fields, text),
  samples: [
    {
      fields: { end: '2024-03-01', mode: 'difference' },
      label: 'Days between',
      text: '2024-01-01',
    },
    {
      fields: { end: '2026-10-26', mode: 'difference' },
      label: 'One working week',
      text: '2026-10-19',
    },
    { fields: { amount: '+1m', mode: 'add' }, label: 'Month end clamp', text: '2024-01-31' },
    { fields: { amount: '+1bd', mode: 'add' }, label: 'Next business day', text: '2026-10-23' },
    { fields: { amount: '+1y 2m 3w 4d', mode: 'add' }, label: 'Mixed units', text: '2026-10-20' },
    { fields: { mode: 'info' }, label: 'ISO week 53', text: '2027-01-01' },
  ],
  supportsSelection: true,
};
