import {
  formatOffset,
  formatter,
  formatWall,
  formatYear,
  isoWeek,
  offsetMinutes,
  pad,
  parseOffset,
  readable,
  timeError,
  utcDate,
  validateWall,
  type Wall,
  wallTime,
  wallToInstant,
} from './timeWall';

export type TimestampUnit = 'auto' | 'ms' | 'ns' | 's' | 'us';

export type TimestampOptions = {
  now?: Date;
  timeZone?: string;
  unit?: TimestampUnit;
};

export type TimestampReport = {
  dayOfYear: number;
  detected: string;
  httpDate: string;
  iso: string;
  isoWeek: string;
  local: string;
  localText: string;
  notes?: string[];
  relative: string;
  rfc2822: string;
  timeZone: string;
  unixMilliseconds: number;
  unixSeconds: number;
  weekday: string;
};

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const unitLabels: Record<Exclude<TimestampUnit, 'auto'>, string> = {
  ms: 'milliseconds',
  ns: 'nanoseconds',
  s: 'seconds',
  us: 'microseconds',
};
const unitExponents: Record<Exclude<TimestampUnit, 'auto'>, number> = {
  ms: 0,
  ns: -6,
  s: 3,
  us: -3,
};
// ICU's legacy short ids. They are not in the IANA database, and BST resolves to Asia/Dhaka and
// CST to America/Chicago, so Intl accepting them would be a silent wrong guess. EST, MST, HST and
// CET are real IANA names and stay valid.
const nonIanaZoneIds = new Set(
  'ACT AET AGT ART AST BET BST CAT CNT CST CTT EAT ECT IET IST JST MIT NET NST PLT PNT PRT PST SST VST'.split(
    ' ',
  ),
);
const isoPattern =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;
const maxMilliseconds = 8_640_000_000_000_000;

export function convertTimestamp(
  value: string,
  options: TimestampOptions | Date = {},
): TimestampReport {
  const settings = options instanceof Date ? { now: options } : options;

  if (value.length > 256) throw timeError('Timestamp input exceeds 256 characters.');

  const now = settings.now ?? new Date();
  const timeZone = resolveTimeZone(settings.timeZone);
  const raw = value.trim();
  const parsed = raw
    ? parseInstant(raw, timeZone, settings.unit ?? 'auto')
    : { detected: 'Current time', milliseconds: now.getTime(), notes: [] };
  const milliseconds = parsed.milliseconds;

  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > maxMilliseconds)
    throw timeError(
      'The date is outside the range JavaScript can represent (about ±275,000 years).',
    );

  const date = new Date(milliseconds);
  const wall = wallTime(milliseconds, timeZone);
  const offset = offsetMinutes(milliseconds, timeZone);
  const weekday = weekdays[utcDate(wall.year, wall.month, wall.day).getUTCDay()];

  if (!weekday) throw new Error('Weekday name is missing.');

  return {
    detected: parsed.detected,
    iso: date.toISOString(),
    unixSeconds: Math.floor(milliseconds / 1000),
    unixMilliseconds: milliseconds,
    timeZone,
    local: `${formatWall(wall)}${formatOffset(offset, ':')}`,
    localText: readable(date, timeZone),
    rfc2822: `${weekday.slice(0, 3)}, ${pad(wall.day)} ${months[wall.month - 1]} ${formatYear(wall.year)} ${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)} ${formatOffset(offset, '')}`,
    httpDate: date.toUTCString(),
    relative: relativeTime((milliseconds - now.getTime()) / 1000),
    weekday,
    isoWeek: isoWeek(wall),
    dayOfYear:
      Math.round(
        (utcDate(wall.year, wall.month, wall.day).getTime() - utcDate(wall.year, 1, 1).getTime()) /
          86_400_000,
      ) + 1,
    ...(parsed.notes.length > 0 ? { notes: parsed.notes } : {}),
  };
}

export function relativeTime(seconds: number): string {
  const units: Array<[string, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const magnitude = Math.abs(seconds);

  if (magnitude < 1) return 'now';

  const [unit, size] = units.find(([, unitSeconds]) => magnitude >= unitSeconds) ?? ['second', 1];
  const count = Math.floor(magnitude / size);
  const text = `${count} ${unit}${count === 1 ? '' : 's'}`;

  return seconds > 0 ? `in ${text}` : `${text} ago`;
}

export function resolveTimeZone(value: string | undefined): string {
  const input = value?.trim() ?? '';

  if (!input || input === 'local') return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  try {
    if (nonIanaZoneIds.has(input.toUpperCase())) throw new RangeError('Not an IANA name.');

    formatter(input);

    return input;
  } catch {
    throw timeError(
      `Unknown time zone "${input}". Use an IANA name such as Europe/Prague or America/New_York.`,
    );
  }
}

function parseInstant(
  raw: string,
  timeZone: string,
  unit: TimestampUnit,
): { detected: string; milliseconds: number; notes: string[] } {
  if (/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return parseNumeric(raw, unit);
  if (unit !== 'auto')
    throw timeError(`A ${unitLabels[unit]} unit needs a number, such as 1700000000.`);

  const iso = raw.match(isoPattern);

  if (iso) return parseIso(iso, timeZone);

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw timeError(
      'Use a Unix timestamp such as 1700000000, an ISO 8601 date such as 2026-06-02T10:00:00Z, or an HTTP date such as Tue, 02 Jun 2026 10:00:00 GMT.',
    );
  }

  const notes = [
    'Non-ISO date text is read by this runtime’s date parser, which can differ between browsers. Prefer ISO 8601.',
  ];

  if (/(?:\b(?:GMT|UTC|UT|Z)\b|[+-]\d{2}:?\d{2}\b|\b[ECMP][SD]T\b)/i.test(raw))
    return { detected: 'Date text with a time zone', milliseconds: parsed.getTime(), notes };

  const wall = {
    day: parsed.getDate(),
    hour: parsed.getHours(),
    millisecond: parsed.getMilliseconds(),
    minute: parsed.getMinutes(),
    month: parsed.getMonth() + 1,
    second: parsed.getSeconds(),
    year: parsed.getFullYear(),
  };
  const resolved = wallToInstant(wall, timeZone);

  return {
    detected: 'Date text without a time zone',
    milliseconds: resolved.milliseconds,
    notes: [
      ...notes,
      `No offset in the input, so it was read as ${formatWall(wall)} in ${timeZone}.`,
      ...resolved.notes,
    ],
  };
}

// Up to 11 digits covers seconds until year 5138; each larger unit adds three digits.
function unitForIntegerDigits(digits: number): Exclude<TimestampUnit, 'auto'> {
  if (digits <= 11) return 's';
  if (digits <= 14) return 'ms';
  if (digits <= 17) return 'us';

  return 'ns';
}

// Works on the decimal text: 1700000000.1 / 0.001 in doubles lands just below the true value.
function exactMilliseconds(raw: string, exponent: number): { dropped: boolean; value: number } {
  const [whole = '', fraction = ''] = raw.replace(/^[+-]/, '').split('.');
  const digits = BigInt(whole + fraction);
  const shift = exponent - fraction.length;
  const divisor = 10n ** BigInt(Math.max(-shift, 0));
  const scaled = digits * 10n ** BigInt(Math.max(shift, 0));
  const dropped = scaled % divisor !== 0n;
  const quotient = scaled / divisor;

  return {
    dropped,
    value: Number(raw.startsWith('-') ? -quotient - (dropped ? 1n : 0n) : quotient),
  };
}

function parseNumeric(
  raw: string,
  unit: TimestampUnit,
): { detected: string; milliseconds: number; notes: string[] } {
  const digits = raw
    .replace(/^[+-]/, '')
    .split('.')[0]!
    .replace(/^0+(?=\d)/, '').length;
  const resolved = unit !== 'auto' ? unit : unitForIntegerDigits(digits);
  const { dropped, value: milliseconds } = exactMilliseconds(raw, unitExponents[resolved]);
  const notes = dropped ? ['Digits below one millisecond are dropped.'] : [];
  const year =
    Math.abs(milliseconds) <= maxMilliseconds ? new Date(milliseconds).getUTCFullYear() : undefined;

  if (unit === 'auto' && year !== undefined && (year < 1900 || year > 2200))
    notes.push(
      `Read as ${unitLabels[resolved]}, this is the year ${year}. Choose the unit if you expected a different date.`,
    );

  return {
    detected: `Unix ${unitLabels[resolved]}${unit === 'auto' ? ` (${digits} ${digits === 1 ? 'digit' : 'digits'})` : ''}`,
    milliseconds,
    notes,
  };
}

function parseIso(
  match: RegExpMatchArray,
  timeZone: string,
): { detected: string; milliseconds: number; notes: string[] } {
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zoneText] =
    match;
  const wall: Wall = {
    day: Number(dayText),
    hour: Number(hourText ?? 0),
    millisecond: Number((fractionText ?? '').padEnd(3, '0').slice(0, 3)),
    minute: Number(minuteText ?? 0),
    month: Number(monthText),
    second: Number(secondText ?? 0),
    year: Number(yearText),
  };

  validateWall(wall, hourText !== undefined);
  const notes =
    fractionText !== undefined && fractionText.length > 3 && /[1-9]/.test(fractionText.slice(3))
      ? ['Digits below one millisecond are dropped.']
      : [];

  if (zoneText) {
    const offset = zoneText.toUpperCase() === 'Z' ? 0 : parseOffset(zoneText);

    return {
      detected:
        zoneText.toUpperCase() === 'Z'
          ? 'ISO 8601 in UTC'
          : `ISO 8601 with offset ${formatOffset(offset, ':')}`,
      milliseconds:
        utcDate(
          wall.year,
          wall.month,
          wall.day,
          wall.hour,
          wall.minute,
          wall.second,
          wall.millisecond,
        ).getTime() -
        offset * 60_000,
      notes,
    };
  }

  const resolved = wallToInstant(wall, timeZone);
  const note =
    hourText === undefined
      ? `Date only, so it was read as midnight in ${timeZone}.`
      : `No offset in the input, so it was read as ${formatWall(wall)} in ${timeZone}.`;

  return {
    detected: hourText === undefined ? 'ISO 8601 date' : 'ISO 8601 date-time without offset',
    milliseconds: resolved.milliseconds,
    notes: [note, ...resolved.notes, ...notes],
  };
}
