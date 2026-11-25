import { FunctionError } from '../errors';

export type CalendarDate = string;

const dayMs = 86_400_000;
const maxAmount = 100_000;
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const rangeMessage = 'Dates are limited to the years 0001 to 9999.';

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function fromDay(day: number): Date {
  return new Date(day * dayMs);
}

function toDay(date: Date): number {
  return Math.floor(date.getTime() / dayMs);
}

function format(date: Date): CalendarDate {
  const year = date.getUTCFullYear();

  if (!(year >= 1 && year <= 9999)) {
    throw new FunctionError('DATE_OUT_OF_RANGE', rangeMessage);
  }

  return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function parse(value: CalendarDate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const date = new Date(0);

  date.setUTCFullYear(year, month - 1, day);

  if (match && (year < 1 || year > 9999)) {
    throw new FunctionError('DATE_OUT_OF_RANGE', rangeMessage);
  }

  if (!match || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new FunctionError(
      'INVALID_DATE',
      `${value.trim() || 'An empty value'} is not a valid calendar date. Use YYYY-MM-DD.`,
    );
  }

  return date;
}

function addMonths(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const last = new Date(0);

  last.setUTCFullYear(year, month + 1, 0);

  const result = new Date(0);

  result.setUTCFullYear(year, month, Math.min(date.getUTCDate(), last.getUTCDate()));

  return result;
}

/** Monday = 0 ... Sunday = 6; the epoch day 0 is a Thursday. */
function weekdayIndex(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

function weekdaysBefore(day: number): number {
  const shifted = day + 3;
  const rest = ((shifted % 7) + 7) % 7;

  return Math.floor(shifted / 7) * 5 + Math.min(rest, 5);
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();

  return addMonths(start, months) > end ? months - 1 : months;
}

function describeSpan(start: Date, end: Date): string {
  const months = monthsBetween(start, end);
  const days = toDay(end) - toDay(addMonths(start, months));
  const parts = [
    [Math.floor(months / 12), 'year'],
    [months % 12, 'month'],
    [days, 'day'],
  ] as const;
  const shown = parts.filter(([count]) => count > 0).map(([count, unit]) => plural(count, unit));

  return shown.length > 0 ? shown.join(', ') : '0 days';
}

export function dateDifference(
  start: CalendarDate,
  end: CalendarDate,
): {
  businessDays: number;
  days: number;
  months: number;
  weeks: { days: number; weeks: number };
  years: number;
  yearsMonthsDays: string;
} {
  const from = parse(start);
  const to = parse(end);
  const days = toDay(to) - toDay(from);
  const sign = days < 0 ? -1 : 1;
  const [early, late] = days < 0 ? [to, from] : [from, to];
  const months = monthsBetween(early, late);
  const span = describeSpan(early, late);

  return {
    businessDays: weekdaysBefore(toDay(to)) - weekdaysBefore(toDay(from)),
    days,
    months: sign * months,
    weeks: { days: sign * (Math.abs(days) % 7), weeks: sign * Math.floor(Math.abs(days) / 7) },
    years: sign * Math.floor(months / 12),
    yearsMonthsDays: days < 0 ? `-${span}` : span,
  };
}

function addBusinessDays(date: Date, count: number): Date {
  if (count === 0) return date;

  let day = toDay(date);
  const step = count < 0 ? -1 : 1;

  while (weekdayIndex(day) > 4) {
    day -= step;
  }

  day += Math.floor(Math.abs(count) / 5) * 7 * step;

  for (let left = Math.abs(count) % 5; left > 0; left -= 1) {
    day += step;

    while (weekdayIndex(day) > 4) {
      day += step;
    }
  }

  return fromDay(day);
}

function parseAmount(amount: string): { sign: number; units: Record<string, number> } {
  const trimmed = amount.trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const tokens = trimmed.replace(/^[+-]\s*/, '').split(/\s+/);
  const units: Record<string, number> = {};

  for (const token of tokens) {
    const match = /^(\d+)(bd|y|m|w|d)$/i.exec(token);

    if (!match) {
      throw new FunctionError(
        'INVALID_AMOUNT',
        'Amount must look like +1y 2m 3w 4d, -10d or +5bd.',
      );
    }

    const unit = (match[2] ?? '').toLowerCase();
    const count = Number(match[1]);

    units[unit] = (units[unit] ?? 0) + count;

    if (units[unit] > maxAmount) {
      throw new FunctionError('AMOUNT_TOO_LARGE', 'Amounts are limited to 100,000 units.');
    }
  }

  if (units.bd !== undefined && Object.keys(units).length > 1) {
    throw new FunctionError('INVALID_AMOUNT', 'Business days cannot be combined with other units.');
  }

  return { sign, units };
}

export function addToDate(start: CalendarDate, amount: string): CalendarDate {
  const date = parse(start);
  const { sign, units } = parseAmount(amount);

  if (units.bd !== undefined) {
    return format(addBusinessDays(date, sign * units.bd));
  }

  const byYears = addMonths(date, sign * (units.y ?? 0) * 12);
  const byMonths = addMonths(byYears, sign * (units.m ?? 0));
  const days = sign * ((units.w ?? 0) * 7 + (units.d ?? 0));

  return format(fromDay(toDay(byMonths) + days));
}

export function dateInfo(date: CalendarDate): {
  dayOfYear: number;
  daysInMonth: number;
  isoWeek: string;
  leapYear: boolean;
  quarter: number;
  weekday: string;
} {
  const value = parse(date);
  const day = toDay(value);
  const weekday = weekdayIndex(day);
  const thursday = fromDay(day - weekday + 3);
  const yearStart = new Date(0);

  yearStart.setUTCFullYear(thursday.getUTCFullYear(), 0, 1);

  const week = Math.floor((day - weekday + 3 - toDay(yearStart)) / 7) + 1;
  const ownStart = new Date(0);
  const monthEnd = new Date(0);

  ownStart.setUTCFullYear(value.getUTCFullYear(), 0, 1);
  monthEnd.setUTCFullYear(value.getUTCFullYear(), value.getUTCMonth() + 1, 0);

  return {
    dayOfYear: day - toDay(ownStart) + 1,
    daysInMonth: monthEnd.getUTCDate(),
    isoWeek: `${pad(thursday.getUTCFullYear(), 4)}-W${pad(week, 2)}-${weekday + 1}`,
    leapYear: isLeap(value.getUTCFullYear()),
    quarter: Math.floor(value.getUTCMonth() / 3) + 1,
    weekday: weekdays[weekday] ?? '',
  };
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The device-local calendar date. */
export function todayDate(now: Date = new Date()): CalendarDate {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}
