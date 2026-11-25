import { FunctionError } from '../errors';

export type CronFieldName = 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';
export type CronFieldReport = {
  maximum: number;
  minimum: number;
  name: CronFieldName;
  raw: string;
  values: number[];
};
export type CronExpressionReport = {
  expression: string;
  fields: CronFieldReport[];
  originalInput: string;
};
type CronFieldSpec = {
  aliases?: Record<string, number>;
  label: string;
  maximum: number;
  minimum: number;
  name: CronFieldName;
};
const specs: CronFieldSpec[] = [
  { label: 'Minute', maximum: 59, minimum: 0, name: 'minute' },
  { label: 'Hour', maximum: 23, minimum: 0, name: 'hour' },
  { label: 'Day of month', maximum: 31, minimum: 1, name: 'dayOfMonth' },
  {
    aliases: {
      APR: 4,
      AUG: 8,
      DEC: 12,
      FEB: 2,
      JAN: 1,
      JUL: 7,
      JUN: 6,
      MAR: 3,
      MAY: 5,
      NOV: 11,
      OCT: 10,
      SEP: 9,
    },
    label: 'Month',
    maximum: 12,
    minimum: 1,
    name: 'month',
  },
  {
    aliases: { FRI: 5, MON: 1, SAT: 6, SUN: 0, THU: 4, TUE: 2, WED: 3 },
    label: 'Day of week',
    maximum: 7,
    minimum: 0,
    name: 'dayOfWeek',
  },
];
const presets: Record<string, string> = {
  daily9: '0 9 * * *',
  dailyMidnight: '0 0 * * *',
  every15: '*/15 * * * *',
  hourly: '0 * * * *',
  monthly: '0 0 1 * *',
  weekdays9: '0 9 * * 1-5',
  weeklyMonday: '0 9 * * MON',
};

export function cronPreset(preset?: string): string {
  const key = preset ?? 'every15';

  const expression = Object.hasOwn(presets, key) ? presets[key] : undefined;

  if (expression === undefined)
    throw cronError(
      'Choose a listed cron preset. Unknown presets are not replaced with Every 15 minutes.',
    );

  return expression;
}

function cronError(message: string): FunctionError {
  return new FunctionError('INVALID_DEV_INPUT', message);
}

function fieldToken(token: string, spec: CronFieldSpec): number {
  if (/^[0-9]+$/.test(token)) return Number(token);
  if (spec.aliases && Object.hasOwn(spec.aliases, token)) return spec.aliases[token] ?? NaN;

  return NaN;
}

function fieldNumber(token: string, spec: CronFieldSpec): number {
  const number = fieldToken(token, spec);

  if (Number.isInteger(number) && (number < spec.minimum || number > spec.maximum))
    throw cronError(`${spec.label} value ${number} is outside ${spec.minimum}-${spec.maximum}.`);
  if (!Number.isInteger(number) || number < spec.minimum || number > spec.maximum)
    throw cronError(
      `${spec.label} values must be from ${spec.minimum} through ${spec.maximum}${spec.aliases ? ' or a supported three-letter English name' : ''}.`,
    );

  return number;
}

function stepNumber(token: string): number {
  return /^[0-9]+$/.test(token) ? Number(token) : NaN;
}

function parseField(raw: string, spec: CronFieldSpec): CronFieldReport {
  const values = new Set<number>();

  for (const piece of raw.toUpperCase().split(',')) {
    if (/^(?:\?|L|LW|L-\d+|\d+[LW]|[0-9A-Z]+#\d+)$/.test(piece))
      throw cronError(
        `${spec.label}: ${piece} is Quartz or Spring syntax. Five-field cron supports values, *, ranges, lists and steps only.`,
      );

    const parts = piece.split('/');
    const [base, stepText] = parts;

    if (parts.length > 2 || !base)
      throw cronError(
        `${spec.label}: provide a nonempty wildcard, value, ascending range or comma-separated list.`,
      );

    const step = stepText === undefined ? 1 : stepNumber(stepText);

    if (!Number.isSafeInteger(step) || step < 1)
      throw cronError(`${spec.label}: step must be a positive safe decimal integer.`);
    if (parts.length > 1 && base !== '*' && !base.includes('-'))
      throw cronError(`${spec.label}: apply steps to * or an explicit range, not a single value.`);

    let start = spec.minimum;
    let end = spec.maximum;

    if (base !== '*') {
      const range = base.split('-');

      if (range.length > 2 || range.some((token) => !/^[0-9A-Z]+$/.test(token)))
        throw cronError(
          `${spec.label}: unsupported field syntax. Use values, *, ascending ranges, lists and steps on ranges or *.`,
        );

      const [startToken = '', endToken] = range;

      start = fieldNumber(startToken, spec);
      end = endToken === undefined ? start : fieldNumber(endToken, spec);
      if (start > end)
        throw cronError(
          `${spec.label}: ranges must be ascending; use a list for a wraparound range.`,
        );
    }

    for (let number = start; number <= end; number += step)
      values.add(spec.name === 'dayOfWeek' && number === 7 ? 0 : number);
  }

  return {
    maximum: spec.maximum,
    minimum: spec.minimum,
    name: spec.name,
    raw,
    values: [...values].sort((a, b) => a - b),
  };
}

export function parseCronExpression(value: string): CronExpressionReport {
  if (value.length > 256) throw cronError('Cron expression is limited to 256 UTF-16 units.');

  const input = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

  if (/\r|\n/.test(input))
    throw cronError('Provide one cron expression on one line, without a command.');

  const tokens = input.split(/[ \t]+/);

  if (tokens.length !== 5)
    throw cronError(
      'Cron expression must have five fields: minute, hour, day of month, month and day of week. No seconds, year or command.',
    );

  const fields = specs.map((spec, index) => parseField(tokens[index]!, spec));

  return {
    expression: tokens.map((token) => token.toUpperCase()).join(' '),
    fields,
    originalInput: value,
  };
}

export type CronDayRule =
  'every-day' | 'day-of-month' | 'day-of-week' | 'or' | 'implementation-dependent';
export type CronExplanationReport = CronExpressionReport & {
  dayRule: CronDayRule;
  explanation: string;
  fieldDescriptions: string[];
  text: string;
  warnings: string[];
};
const weekdayNames: string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const monthNames: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const fieldLabels: Record<CronFieldName, string> = {
  dayOfMonth: 'Day of month',
  dayOfWeek: 'Day of week',
  hour: 'Hour',
  minute: 'Minute',
  month: 'Month',
};

function namedValue(field: CronFieldReport, number: number): string {
  if (field.name === 'dayOfWeek') return `${number} (${weekdayNames[number]})`;
  if (field.name === 'month') return `${number} (${monthNames[number - 1]})`;

  return String(number);
}

function describeField(field: CronFieldReport): string {
  if (field.raw === '*') return 'every allowed value';

  const [first] = field.values;
  const last = field.values.at(-1);

  if (first === undefined || last === undefined)
    throw cronError(`${fieldLabels[field.name]} has no matching values.`);
  if (field.values.length === 1) return `at ${namedValue(field, first)}`;
  if (
    /^[0-9A-Za-z]+-[0-9A-Za-z]+$/.test(field.raw) &&
    !(field.name === 'dayOfWeek' && /-7$/.test(field.raw))
  )
    return `from ${namedValue(field, first)} through ${namedValue(field, last)}`;

  return `at ${field.values.map((number) => namedValue(field, number)).join(', ')}${field.raw.includes('/') ? ' (step resets inside this field)' : ''}`;
}

function cronFields(
  report: CronExpressionReport,
): [CronFieldReport, CronFieldReport, CronFieldReport, CronFieldReport, CronFieldReport] {
  const [minute, hour, day, month, weekday] = report.fields;

  if (!minute || !hour || !day || !month || !weekday)
    throw cronError(
      'Cron expression must have five fields: minute, hour, day of month, month and day of week. No seconds, year or command.',
    );

  return [minute, hour, day, month, weekday];
}

// Day-of-month and day-of-week combine with OR when both are restricted (classic cron semantics).
function cronDayRule(day: CronFieldReport, weekday: CronFieldReport): CronDayRule {
  const complexWildcard = [day, weekday].some(
    (field) => field.raw !== '*' && field.raw.includes('*'),
  );

  if (complexWildcard) return 'implementation-dependent';
  if (day.raw === '*') return weekday.raw === '*' ? 'every-day' : 'day-of-week';

  return weekday.raw === '*' ? 'day-of-month' : 'or';
}

export function inspectCronExpression(value: string): CronExplanationReport {
  const parsed = parseCronExpression(value);
  const [, , day, , weekday] = cronFields(parsed);
  const dayRule = cronDayRule(day, weekday);
  const explanation = plainEnglishCron(parsed, dayRule);
  const warnings = cronWarnings(parsed, dayRule);
  const fieldDescriptions = parsed.fields.map(
    (field) => `${fieldLabels[field.name]}: ${describeField(field)}`,
  );
  const text = [
    `Expression: ${parsed.expression}`,
    `Plain English: ${explanation}`,
    ...fieldDescriptions,
    `Day matching model: ${dayRule}`,
    '',
    'Warnings:',
    ...warnings.map((warning) => `- ${warning}`),
  ].join('\n');

  return { ...parsed, dayRule, explanation, fieldDescriptions, text, warnings };
}

function plainEnglishCron(parsed: CronExpressionReport, dayRule: CronDayRule): string {
  const [minute, hour, day, month, weekday] = cronFields(parsed);

  if (parsed.fields.every((field) => field.raw === '*'))
    return 'Every minute in the scheduler timezone.';
  if (
    hour.raw === '*' &&
    day.raw === '*' &&
    month.raw === '*' &&
    weekday.raw === '*' &&
    /^\*\/[0-9]+$/.test(minute.raw)
  ) {
    const step = Number(minute.raw.slice(2));

    return `At minutes ${minute.values.join(', ')} of every hour${step <= 30 && 60 % step === 0 ? ` (every ${step} minutes within each hour)` : ''}. Scheduler timezone applies.`;
  }

  const monthText =
    month.raw === '*'
      ? 'in every month'
      : `in ${month.values.map((number) => monthNames[number - 1]).join(', ')}`;
  const weekdayList = weekday.values.map((number) => weekdayNames[number]).join(', ');
  const dayTexts: Record<CronDayRule, string> = {
    'day-of-month': `on day-of-month values ${day.values.join(', ')}`,
    'day-of-week': `on ${weekdayList}`,
    'every-day': 'every day',
    'implementation-dependent': 'day-field combination depends on the scheduler implementation',
    or: `on day-of-month values ${day.values.join(', ')} OR ${weekdayList}`,
  };
  const clockText =
    minute.values.length === 1 && hour.values.length === 1
      ? `At ${String(hour.values[0]).padStart(2, '0')}:${String(minute.values[0]).padStart(2, '0')}`
      : `At ${minute.raw === '*' ? 'every minute' : `minute values ${minute.values.join(', ')}`} during ${hour.raw === '*' ? 'every hour' : `hour values ${hour.values.join(', ')}`}`;

  return `${clockText} ${monthText}; ${dayTexts[dayRule]}. Scheduler timezone applies.`;
}

function cronWarnings(parsed: CronExpressionReport, dayRule: CronDayRule): string[] {
  const [, , day, month] = cronFields(parsed);
  const warnings: string[] = [];

  if (parsed.fields.some((field) => field.raw.includes('/')))
    warnings.push(
      'Steps reset inside their own field. Field steps are not a promise of a continuous elapsed-time interval.',
    );
  if (dayRule === 'or')
    warnings.push(
      'Traditional five-field cron joins restricted day-of-month and day-of-week with OR, not AND. This is not a first-weekday-of-month selector; check your scheduler dialect.',
    );
  if (dayRule === 'implementation-dependent')
    warnings.push(
      'Wildcard steps or lists in day fields combine differently across schedulers. Next runs follow Vixie cron and cronie, where a day field starting with * is combined with AND.',
    );

  if (
    dayRule === 'day-of-month' &&
    !month.values.some((number) => day.values.some((date) => date <= leapYearMonthLength(number)))
  )
    warnings.push(
      'No calendar date satisfies these day/month values under the day-of-month-only model, even allowing a leap February. No job execution is simulated.',
    );

  warnings.push(
    'Actual execution depends on the scheduler’s timezone, daylight-saving handling and cron dialect.',
  );

  return warnings;
}

function leapYearMonthLength(month: number): number {
  return new Date(Date.UTC(2000, month, 0)).getUTCDate();
}

export type CronRunTimeZone = 'local' | 'utc';
export type CronRun = { iso: string; text: string };
const weekdayShortNames: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const searchDays = 25 * 366;

function pad(number: number): string {
  return String(number).padStart(2, '0');
}

function utcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();

  return `UTC${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

function cronRunText(instant: Date, isUtc: boolean): string {
  const [y, m, d, h, min, wd] = isUtc
    ? [
        instant.getUTCFullYear(),
        instant.getUTCMonth(),
        instant.getUTCDate(),
        instant.getUTCHours(),
        instant.getUTCMinutes(),
        instant.getUTCDay(),
      ]
    : [
        instant.getFullYear(),
        instant.getMonth(),
        instant.getDate(),
        instant.getHours(),
        instant.getMinutes(),
        instant.getDay(),
      ];

  return `${weekdayShortNames[wd]} ${y}-${pad(m + 1)}-${pad(d)} ${pad(h)}:${pad(min)} ${isUtc ? 'UTC' : utcOffset(instant)}`;
}

export function nextCronRuns(
  report: CronExpressionReport,
  { count, from, timeZone }: { count: number; from: Date; timeZone: CronRunTimeZone },
): CronRun[] {
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw cronError('Choose from 1 to 100 next runs.');
  if (Number.isNaN(from.getTime())) throw cronError('Choose a valid start date and time.');

  const [minuteField, hourField, dayField, monthField, weekdayField] = cronFields(report);
  const day = new Set(dayField.values);
  const month = new Set(monthField.values);
  const weekday = new Set(weekdayField.values);
  const eitherDay = !dayField.raw.startsWith('*') && !weekdayField.raw.startsWith('*');
  const isUtc = timeZone === 'utc';
  const start = isUtc
    ? Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
    : Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const runs: CronRun[] = [];
  const seen = new Set<number>();

  for (let offset = 0; offset < searchDays && runs.length < count; offset += 1) {
    const calendar = new Date(start + offset * 86_400_000);
    const [year, monthIndex, date] = [
      calendar.getUTCFullYear(),
      calendar.getUTCMonth(),
      calendar.getUTCDate(),
    ];

    if (!month.has(monthIndex + 1)) continue;

    const dayMatch = day.has(date);
    const weekdayMatch = weekday.has(calendar.getUTCDay());

    if (eitherDay ? !dayMatch && !weekdayMatch : !dayMatch || !weekdayMatch) continue;

    for (const hourValue of hourField.values) {
      for (const minuteValue of minuteField.values) {
        const instant = isUtc
          ? new Date(Date.UTC(year, monthIndex, date, hourValue, minuteValue))
          : new Date(year, monthIndex, date, hourValue, minuteValue);

        if (instant.getTime() <= from.getTime() || seen.has(instant.getTime())) continue;
        if (
          !isUtc &&
          (instant.getDate() !== date ||
            instant.getHours() !== hourValue ||
            instant.getMinutes() !== minuteValue)
        )
          continue;

        seen.add(instant.getTime());
        runs.push({ iso: instant.toISOString(), text: cronRunText(instant, isUtc) });

        if (runs.length === count) return runs;
      }
    }
  }

  return runs;
}
