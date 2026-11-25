import { ToolError, type ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import {
  cronPreset,
  inspectCronExpression,
  nextCronRuns,
  type CronRunTimeZone,
} from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const customFields = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'] as const;
const defaults: Record<(typeof customFields)[number], string> = {
  dayOfMonth: '*',
  dayOfWeek: '*',
  hour: '9',
  minute: '0',
  month: '*',
};
const labels: Record<(typeof customFields)[number], string> = {
  dayOfMonth: 'Day of month',
  dayOfWeek: 'Day of week',
  hour: 'Hour',
  minute: 'Minute',
  month: 'Month',
};
const fromBuilder = { field: 'source', is: ['builder'] };
const customField = (id: (typeof customFields)[number], help: string): ToolField => ({
  defaultValue: defaults[id],
  help,
  id,
  label: labels[id],
  type: 'text',
  visibleWhen: [fromBuilder, { field: 'preset', is: ['custom'] }],
});

function builtExpression(fields: Record<string, string>): string {
  const preset = fields.preset ?? 'every15';

  if (preset !== 'custom') return withToolError(() => cronPreset(preset));

  return customFields
    .map((field) => {
      const raw = fields[field] ?? defaults[field];

      if (raw.length > 256) throw new ToolError(`${labels[field]} is limited to 256 UTF-16 units.`);

      const token = raw.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

      if (!token || /[ \t\r\n]/.test(token))
        throw new ToolError(
          `${labels[field]} must contain one nonempty cron field, not multiple whitespace-separated fields.`,
        );

      return token;
    })
    .join(' ');
}

function startDate(value: string | undefined, timeZone: CronRunTimeZone): Date {
  const text = (value ?? '').trim();

  if (!text) return new Date();

  const invalidStart = new ToolError(
    'Write the start as YYYY-MM-DD or YYYY-MM-DD HH:MM, or leave it blank for now.',
  );
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(text);

  if (!match) throw invalidStart;

  const [year = 0, month = 0, day = 0, hour = 0, minute = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const date =
    timeZone === 'utc'
      ? new Date(Date.UTC(year, month - 1, day, hour, minute))
      : new Date(year, month - 1, day, hour, minute);
  // A date that rolled over (for example February 30) no longer matches its own fields.
  const parts =
    timeZone === 'utc'
      ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours()]
      : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()];

  // Only a local clock jump moves the hour and keeps the date: a time in a daylight saving gap.
  if (parts.slice(0, 3).join() === [year, month, day].join() && parts[3] !== hour)
    throw new ToolError(
      `${text} does not exist on that day; the clocks skip it. Pick another time.`,
    );
  if (parts.join() !== [year, month, day, hour].join() || minute > 59) throw invalidStart;

  return date;
}

const builder = {
  dayOfMonth: '*',
  dayOfWeek: '*',
  hour: '9',
  minute: '0',
  month: '*',
  output: 'expression',
  preset: 'every15',
  source: 'builder',
};

const explain = (expression: string, output = 'explanation'): Record<string, string> => ({
  expression,
  output,
  source: 'expression',
});

export const cronExplainTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Date & Time',
  description:
    'Explain a five-field cron expression in plain English or build one from presets and fields, then list its next run times in UTC or your timezone.',
  samples: [
    { fields: explain('*/15 * * * *'), label: 'Explain: every 15 minutes' },
    { fields: explain('*/35 * * * *'), label: 'Explain: not a continuous 35-minute interval' },
    { fields: explain('0 9 * * MON-FRI'), label: 'Explain: weekdays at 09:00' },
    { fields: explain('0,30 9-17 * * MON-FRI'), label: 'Explain: business-hour value sets' },
    { fields: explain('0 9 1 * MON'), label: 'Explain: day of month OR weekday' },
    { fields: explain('0 9 */2 * MON'), label: 'Explain: wildcard day combination' },
    { fields: explain('0 0 31 APR *'), label: 'Explain: no compatible day in April' },
    { fields: explain('0 0 29 FEB *'), label: 'Explain: leap day' },
    {
      fields: explain('0 0 1 jan,apr,jul,oct *', 'report'),
      label: 'Explain: quarterly JSON audit',
    },
    { fields: { ...builder, preset: 'hourly' }, label: 'Build: hourly' },
    { fields: { ...builder, preset: 'weekdays9' }, label: 'Build: weekdays at 09:00' },
    { fields: { ...builder, preset: 'monthly' }, label: 'Build: first day of each month' },
    {
      fields: { ...builder, dayOfWeek: 'MON-FRI', hour: '9-17', minute: '0,30', preset: 'custom' },
      label: 'Build: custom business hours',
    },
    {
      fields: {
        ...builder,
        dayOfMonth: '1',
        hour: '0',
        month: 'jan,apr,jul,oct',
        preset: 'custom',
      },
      label: 'Build: quarterly first day',
    },
    {
      fields: { ...builder, minute: '5-59/15', preset: 'custom' },
      label: 'Build: explicit range step',
    },
  ],
  fields: [
    {
      defaultValue: 'expression',
      id: 'source',
      label: 'Start from',
      options: [
        { label: 'Expression', value: 'expression' },
        { label: 'Builder', value: 'builder' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '*/15 * * * *',
      help: 'Five fields only: minute, hour, day of month, month, day of week. No seconds, year or command.',
      id: 'expression',
      label: 'Cron expression',
      placeholder: '*/15 * * * *',
      type: 'text',
      visibleWhen: { field: 'source', is: ['expression'] },
    },
    {
      defaultValue: 'every15',
      id: 'preset',
      label: 'Preset',
      options: [
        { label: 'Every 15 minutes', value: 'every15' },
        { label: 'Hourly', value: 'hourly' },
        { label: 'Daily at 09:00', value: 'daily9' },
        { label: 'Weekdays at 09:00', value: 'weekdays9' },
        { label: 'Daily at midnight', value: 'dailyMidnight' },
        { label: 'Monday at 09:00', value: 'weeklyMonday' },
        { label: 'First day of each month', value: 'monthly' },
        { label: 'Custom fields', value: 'custom' },
      ],
      type: 'select',
      visibleWhen: fromBuilder,
    },
    customField('minute', '0–59. Example: 0,30 or */15.'),
    customField('hour', '0–23 in the scheduler’s timezone. Example: 9-17.'),
    customField('dayOfMonth', '1–31 or *. Example: 1,15.'),
    customField('month', '1–12 or JAN–DEC. Example: JAN,APR,JUL,OCT.'),
    customField(
      'dayOfWeek',
      '0–7; 0 and 7 are Sunday. Names SUN–SAT are supported. Example: MON-FRI.',
    ),
    {
      defaultValue: 'utc',
      help: 'This device uses the timezone of the browser, desktop app or VS Code.',
      id: 'timezone',
      label: 'Next runs in',
      options: [
        { label: 'UTC', value: 'utc' },
        { label: 'This device', value: 'local' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '5',
      id: 'runs',
      label: 'Runs to list',
      options: [
        { label: '5', value: '5' },
        { label: '10', value: '10' },
        { label: '25', value: '25' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'Leave blank for now, or enter YYYY-MM-DD HH:MM in the timezone above.',
      id: 'startAt',
      label: 'Runs after',
      placeholder: 'now',
      type: 'text',
    },
    {
      defaultValue: 'explanation',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Explanation', value: 'explanation' },
        { label: 'Expression', value: 'expression' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'cron-explain',
  selectionTarget: { field: 'expression', fields: { source: 'expression' } },
  inputKind: 'none',
  keywords: [
    'cron',
    'crontab',
    'cron expression',
    'cron explain',
    'cron generator',
    'cron builder',
    'schedule',
    'next run',
    'day matching',
    'preset',
  ],
  name: 'Cron Explainer & Generator',
  outputKind: 'text',
  relatedToolIds: ['timestamp-convert', 'chmod-calculator', 'docker-to-compose'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => runCron(fields, text),
  supportsSelection: true,
  freshResults: true,
};

type CronResult = ReturnType<typeof inspectCronExpression>;
type CronRuns = ReturnType<typeof nextCronRuns>;
type CronOutput = 'explanation' | 'expression' | 'report';

function parseCronOptions(fields: Record<string, string>): {
  count: number;
  output: CronOutput;
  source: 'builder' | 'expression';
  timeZone: CronRunTimeZone;
} {
  const source = fields.source || 'expression';

  if (source !== 'expression' && source !== 'builder')
    throw new ToolError('Choose Expression or Builder.');

  const output = fields.output || 'explanation';

  if (output !== 'explanation' && output !== 'expression' && output !== 'report')
    throw new ToolError('Choose Explanation, Expression or JSON audit.');

  const timeZone = fields.timezone || 'utc';

  if (timeZone !== 'utc' && timeZone !== 'local') throw new ToolError('Choose UTC or This device.');

  const count = Number(fields.runs || '5');

  if (![5, 10, 25].includes(count)) throw new ToolError('Choose 5, 10 or 25 runs.');

  return { count, output, source, timeZone };
}

function readableCron(result: CronResult, runs: CronRuns, zone: string): string {
  return [
    `Expression: ${result.expression}`,
    `Plain English: ${result.explanation}`,
    ...result.fieldDescriptions,
    `Day matching model: ${result.dayRule}`,
    '',
    runs.length ? `Next ${runs.length} runs (${zone}):` : `No run in the next 25 years (${zone}).`,
    ...runs.map((run) => `- ${run.text}`),
    '',
    'Warnings:',
    ...result.warnings.map((warning) => `- ${warning}`),
  ].join('\n');
}

function runCron(fields: Record<string, string>, text: string): ToolResult {
  const { count, output, source, timeZone } = parseCronOptions(fields);
  const from = startDate(fields.startAt, timeZone);
  const expression =
    source === 'builder'
      ? builtExpression(fields)
      : (fields.expression ?? (text || '*/15 * * * *'));
  const result = withToolError(() => inspectCronExpression(expression));
  const runs = withToolError(() => nextCronRuns(result, { count, from, timeZone }));
  const zone =
    timeZone === 'utc' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone || 'this device';
  const readable = readableCron(result, runs, zone);
  const report = JSON.stringify(
    {
      dayMatching: 'Vixie cron and cronie',
      from: from.toISOString(),
      nextRuns: runs,
      ...(source === 'builder' ? { preset: fields.preset ?? 'every15' } : {}),
      result,
      source,
      timezone: zone,
    },
    null,
    2,
  );
  const files = {
    expression: {
      base64: encodeBase64Text(result.expression),
      fileName: 'cron-expression.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    explanation: {
      base64: encodeBase64Text(readable),
      fileName: 'cron-explanation.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    report: {
      base64: encodeBase64Text(report),
      fileName: 'cron-report.json',
      mimeType: 'application/json;charset=utf-8',
    },
  };

  return {
    artifact: files[output],
    artifacts: (['expression', 'explanation', 'report'] as const)
      .filter((name) => name !== output)
      .map((name) => files[name]),
    language: output === 'report' ? 'json' : 'plaintext',
    summary: `${result.expression} · ${result.explanation} Next run: ${runs[0]?.text ?? 'none in the next 25 years'}. No job is created.`,
    text: { expression: result.expression, explanation: readable, report }[output],
  };
}

const builderDefaults: Record<string, string> = { output: 'expression', source: 'builder' };

export const cronGeneratorTool: ToolDefinition = {
  ...cronExplainTool,
  aliasOf: 'cron-explain',
  fields: cronExplainTool.fields?.map((field) =>
    field.id in builderDefaults ? { ...field, defaultValue: builderDefaults[field.id] } : field,
  ),
  id: 'cron-generator',
  name: 'Cron Generator',
  run: (input) =>
    cronExplainTool.run({
      ...input,
      fields: {
        ...builderDefaults,
        ...Object.fromEntries(Object.entries(input.fields).filter(([, value]) => value !== '')),
      },
    }),
};
