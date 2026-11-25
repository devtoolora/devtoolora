import { FunctionError } from '../errors';

export type DurationUnit = 'd' | 'h' | 'm' | 'ms' | 's';
export type DurationBreakdown = {
  clock: string;
  human: string;
  iso: string;
  milliseconds: number;
  totals: { days: number; hours: number; minutes: number; seconds: number };
};

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const week = 7 * day;
const maxMilliseconds = 1000 * 365.25 * day;
const unitMilliseconds: Record<string, number> = {
  d: day,
  h: hour,
  m: minute,
  ms: 1,
  s: second,
  w: week,
};
const decimal = '(\\d+(?:\\.\\d+)?)';
const isoPattern = new RegExp(
  `^P(?:${decimal}W|(?:${decimal}D)?(?:T(?:${decimal}H)?(?:${decimal}M)?(?:${decimal}S)?)?)$`,
  'i',
);
const clockPattern = /^(\d+):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const tokenPattern = new RegExp(`${decimal}\\s*(ms|w|d|h|m|s)`, 'gi');
const tokensPattern = new RegExp(`^(?:${decimal}\\s*(?:ms|w|d|h|m|s)\\s*)+$`, 'i');
const invalidMessage = 'Enter a duration such as 90m, 1h 30m, PT1H30M, 01:30:00 or a number.';

function invalid(): FunctionError {
  return new FunctionError('INVALID_DURATION', invalidMessage);
}

function limited(milliseconds: number): number {
  if (!Number.isFinite(milliseconds) || milliseconds > maxMilliseconds) {
    throw new FunctionError('DURATION_TOO_LARGE', 'Duration is limited to 1,000 years.');
  }

  return Math.round(milliseconds);
}

function parseIso(input: string): number {
  const parts = isoPattern.exec(input);

  if (parts === null || /t$/i.test(input) || parts.slice(1).every((part) => part === undefined)) {
    const years = /^P(\d+(?:\.\d+)?)Y/i.exec(input);

    if (years !== null) limited(Number(years[1]) * 365.25 * day);

    throw invalid();
  }

  const [, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0] = parts.map((part) =>
    Number(part ?? 0),
  );

  return limited(weeks * week + days * day + hours * hour + minutes * minute + seconds * second);
}

function parseClock(parts: RegExpExecArray): number {
  const minutes = Number(parts[2]);
  const seconds = Number(parts[3] ?? 0);

  if (minutes >= 60 || seconds >= 60) throw invalid();

  const fraction = Number((parts[4] ?? '').padEnd(3, '0'));

  return limited(Number(parts[1]) * hour + minutes * minute + seconds * second + fraction);
}

function parseTokens(input: string): number {
  const seen = new Set<string>();
  let total = 0;

  for (const [, amount, unit] of input.matchAll(tokenPattern)) {
    const key = unit!.toLowerCase();
    const factor = unitMilliseconds[key];

    if (factor === undefined || seen.has(key)) throw invalid();

    seen.add(key);
    total += Number(amount) * factor;
  }

  return limited(total);
}

export function parseDuration(input: string, options: { unit: DurationUnit }): number {
  const text = input.trim();

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const factor = unitMilliseconds[options.unit];

    if (factor === undefined) throw invalid();

    return limited(Number(text) * factor);
  }

  if (/^P/i.test(text)) return parseIso(text);

  const clock = clockPattern.exec(text);

  if (clock !== null) return parseClock(clock);

  if (tokensPattern.test(text)) return parseTokens(text);

  throw invalid();
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function isoDuration(days: number, hours: number, minutes: number, rest: number): string {
  const clockPart =
    (hours > 0 ? `${hours}H` : '') +
    (minutes > 0 ? `${minutes}M` : '') +
    (rest > 0 ? `${rest / second}S` : '');

  if (clockPart === '') return days > 0 ? `P${days}D` : 'PT0S';

  return `P${days > 0 ? `${days}D` : ''}T${clockPart}`;
}

export function describeDuration(milliseconds: number): DurationBreakdown {
  const days = Math.floor(milliseconds / day);
  const hours = Math.floor((milliseconds % day) / hour);
  const minutes = Math.floor((milliseconds % hour) / minute);
  const seconds = Math.floor((milliseconds % minute) / second);
  const millis = milliseconds % second;
  const human = [
    [days, 'd'],
    [hours, 'h'],
    [minutes, 'min'],
    [seconds, 's'],
    [millis, 'ms'],
  ]
    .filter(([amount]) => amount !== 0)
    .map(([amount, label]) => `${amount} ${label}`)
    .join(' ');
  const totalHours = Math.floor(milliseconds / hour);

  return {
    clock: `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}${millis > 0 ? `.${pad(millis, 3)}` : ''}`,
    human: human === '' ? '0 s' : human,
    iso: isoDuration(days, hours, minutes, milliseconds % minute),
    milliseconds,
    totals: {
      days: milliseconds / day,
      hours: milliseconds / hour,
      minutes: milliseconds / minute,
      seconds: milliseconds / second,
    },
  };
}
