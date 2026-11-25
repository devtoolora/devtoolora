import { FunctionError } from '../errors';

export type Wall = {
  day: number;
  hour: number;
  millisecond: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

export function validateWall(wall: Wall, hasTime: boolean): void {
  if (wall.month < 1 || wall.month > 12)
    throw timeError(`Month ${wall.month} does not exist; use 01–12.`);

  const days =
    new Date(Date.UTC(2000, wall.month, 0)).getUTCDate() -
    (wall.month === 2 && !isLeapYear(wall.year) ? 1 : 0);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
    utcDate(2000, wall.month, 1),
  );

  if (wall.day < 1 || wall.day > days)
    throw timeError(
      `${month} ${formatYear(wall.year)} has ${days} days, so day ${wall.day} does not exist.`,
    );
  if (hasTime && (wall.hour > 23 || wall.minute > 59 || wall.second > 59))
    throw timeError(
      'Times run from 00:00:00 to 23:59:59; leap seconds and 24:00 are not accepted.',
    );
}

export function wallToInstant(
  wall: Wall,
  timeZone: string,
): { milliseconds: number; notes: string[] } {
  const guess = utcDate(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond,
  ).getTime();
  const offsets = [
    ...new Set([
      offsetMilliseconds(guess - 86_400_000, timeZone),
      offsetMilliseconds(guess + 86_400_000, timeZone),
      offsetMilliseconds(guess, timeZone),
    ]),
  ];
  const valid = offsets
    .map((offset) => guess - offset)
    .filter((instant, index) => offsetMilliseconds(instant, timeZone) === offsets[index])
    .sort((left, right) => left - right);

  if (valid.length === 0) {
    const before = guess - offsetMilliseconds(guess - 86_400_000, timeZone);

    return {
      milliseconds: before,
      notes: [
        `${formatWall(wall)} does not exist in ${timeZone} because the clocks jump forward, so the matching later time is shown.`,
      ],
    };
  }

  const unique = [...new Set(valid)];
  const [earliest] = unique;

  if (earliest === undefined) throw new Error('No valid instant was found.');

  if (unique.length > 1)
    return {
      milliseconds: earliest,
      notes: [
        `${formatWall(wall)} happens twice in ${timeZone} because the clocks fall back; the earlier one is shown.`,
      ],
    };

  return { milliseconds: earliest, notes: [] };
}

export function wallTime(milliseconds: number, timeZone: string): Wall {
  const parts = formatter(timeZone).formatToParts(new Date(milliseconds));
  const part = (type: string): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  const era = parts.find((candidate) => candidate.type === 'era')?.value;
  const year = era && /^B/i.test(era) ? 1 - part('year') : part('year');

  return {
    day: part('day'),
    hour: part('hour') % 24,
    millisecond: ((milliseconds % 1000) + 1000) % 1000,
    minute: part('minute'),
    month: part('month'),
    second: part('second'),
    year,
  };
}

export function offsetMinutes(milliseconds: number, timeZone: string): number {
  return Math.round(offsetMilliseconds(milliseconds, timeZone) / 60_000);
}

// Historic local mean time offsets carry seconds, such as +0:57:44 for Prague before 1891.
function offsetMilliseconds(milliseconds: number, timeZone: string): number {
  const wall = wallTime(milliseconds, timeZone);
  const asUtc = utcDate(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond,
  ).getTime();

  return asUtc - milliseconds;
}

export function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatters.get(timeZone);

  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      era: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
      minute: 'numeric',
      month: 'numeric',
      second: 'numeric',
      timeZone,
      year: 'numeric',
    });

    formatters.set(timeZone, value);
  }

  return value;
}

export function readable(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone,
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}

export function isoWeek(wall: Wall): string {
  const date = utcDate(wall.year, wall.month, wall.day).getTime();
  const weekday = (new Date(date).getUTCDay() + 6) % 7;
  const weekYear = new Date(date + (3 - weekday) * 86_400_000).getUTCFullYear();
  const january4 = utcDate(weekYear, 1, 4).getTime();
  const firstMonday = january4 - ((new Date(january4).getUTCDay() + 6) % 7) * 86_400_000;
  const week = Math.floor((date - weekday * 86_400_000 - firstMonday) / 604_800_000) + 1;

  return `${formatYear(weekYear)}-W${pad(week)}-${weekday + 1}`;
}

export function utcDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const date = new Date(0);

  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);

  return date;
}

export function parseOffset(value: string): number {
  const digits = value.slice(1).replace(':', '');
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2) || 0);

  if (hours > 23 || minutes > 59) throw timeError(`UTC offset ${value} is out of range.`);

  return (value.startsWith('-') ? -1 : 1) * (hours * 60 + minutes);
}

export function formatWall(wall: Wall): string {
  const fraction = wall.millisecond ? `.${String(wall.millisecond).padStart(3, '0')}` : '';

  return `${formatYear(wall.year)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${fraction}`;
}

export function formatOffset(minutes: number, separator: '' | ':'): string {
  const sign = minutes < 0 ? '-' : '+';
  const magnitude = Math.abs(minutes);

  return `${sign}${pad(Math.floor(magnitude / 60))}${separator}${pad(magnitude % 60)}`;
}

export function formatYear(year: number): string {
  return year >= 0 && year <= 9999
    ? String(year).padStart(4, '0')
    : `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(6, '0')}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function timeError(message: string): FunctionError {
  return new FunctionError('INVALID_WEB_INPUT', message);
}
