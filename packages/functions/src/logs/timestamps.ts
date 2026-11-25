import { parseRfc5322Date } from '../web/emailDate';
import { wallToInstant, type Wall } from '../web/timeWall';

type TimestampFormat = 'apache' | 'iso' | 'rfc2822' | 'slashed' | 'syslog' | 'unix-ms' | 'unix-s';

export type TimestampMatch = {
  end: number;
  format: TimestampFormat;
  fraction?: string;
  start: number;
  time: number;
};

export type TimestampOptions = { dateOrder: 'dmy' | 'mdy'; timeZone: string; year: number };

type Parsed = { fraction?: string; time: number };
type Pattern = {
  build: (match: RegExpExecArray, options: TimestampOptions) => Parsed | undefined;
  format: TimestampFormat;
  regex: RegExp;
};

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthNumber(name: string | undefined): number {
  return months.indexOf((name ?? '').toLowerCase()) + 1;
}

function isValidWall(wall: Wall): boolean {
  if (wall.month < 1 || wall.month > 12) return false;

  const days = new Date(Date.UTC(2000 + (wall.year % 400), wall.month, 0)).getUTCDate();

  return (
    wall.day >= 1 && wall.day <= days && wall.hour < 24 && wall.minute < 60 && wall.second < 60
  );
}

function makeWall(
  values: (string | undefined)[],
  millisecond: number,
  year?: number,
): Wall | undefined {
  const [month = 0, day = 0, hour = 0, minute = 0, second = 0] = values.map(Number);
  const wall = {
    day,
    hour,
    millisecond,
    minute,
    month,
    second,
    year: year ?? 0,
  };

  return isValidWall(wall) ? wall : undefined;
}

// Fixed offsets in minutes. EST to PDT follow RFC 5322, like the RFC 2822 pattern below; a name
// outside this table cannot be told from a log level such as INFO, so it stays message text.
const zoneNames: Record<string, number> = {
  CDT: -300,
  CEST: 120,
  CET: 60,
  CST: -360,
  EDT: -240,
  EEST: 180,
  EET: 120,
  EST: -300,
  GMT: 0,
  MDT: -360,
  MST: -420,
  PDT: -420,
  PST: -480,
  UT: 0,
  UTC: 0,
  WEST: 60,
  WET: 0,
};

function offsetOf(value: string): number {
  const digits = value.replace(':', '');

  return (
    (value.startsWith('-') ? -1 : 1) * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3)))
  );
}

function fractionMs(digits: string | undefined): { fraction?: string; ms: number } {
  if (digits === undefined) return { ms: 0 };

  const fraction = digits.slice(0, 3).padEnd(3, '0');

  return { fraction, ms: Number(fraction) };
}

function absolute(wall: Wall, offset: number): number {
  // Date.UTC maps years 0-99 to 1900-1999, so set the year separately.
  const date = new Date(0);

  date.setUTCFullYear(wall.year, wall.month - 1, wall.day);
  date.setUTCHours(wall.hour, wall.minute, wall.second, wall.millisecond);

  return date.getTime() - offset * 60_000;
}

function buildIso(match: RegExpExecArray, options: TimestampOptions): Parsed | undefined {
  const { fraction, ms } = fractionMs(match[7]);
  const wall = makeWall(match.slice(2, 7), ms, Number(match[1]));

  if (!wall) return undefined;

  const zone = match[8];
  const time =
    zone === undefined
      ? wallToInstant(wall, options.timeZone).milliseconds
      : absolute(wall, zone === 'Z' ? 0 : (zoneNames[zone.trim()] ?? offsetOf(zone.trim())));

  return { fraction, time };
}

function buildApache(match: RegExpExecArray): Parsed | undefined {
  return { time: parseApacheTime(match[0]) ?? Number.NaN };
}

function buildSyslog(match: RegExpExecArray, options: TimestampOptions): Parsed | undefined {
  const month = monthNumber(match[1]);
  const wall = month ? makeWall([String(month), ...match.slice(2, 6)], 0, options.year) : undefined;

  return wall && { time: wallToInstant(wall, options.timeZone).milliseconds };
}

function buildSlashed(match: RegExpExecArray, options: TimestampOptions): Parsed | undefined {
  const [first, second] = options.dateOrder === 'mdy' ? [match[1], match[2]] : [match[2], match[1]];
  const wall = makeWall([first, second, ...match.slice(4, 7)], 0, Number(match[3]));

  return wall && { time: wallToInstant(wall, options.timeZone).milliseconds };
}

const patterns: Pattern[] = [
  {
    build: buildIso,
    format: 'iso',
    regex:
      /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?(?!\d|:\d)| [+-]\d{2}:?\d{2}(?!\d|:\d)| (?:UTC?|GMT|[CE]EST|[CE]ET|WEST|WET|[ECMP][SD]T)(?![\w+-]))?/g,
  },
  {
    build: buildApache,
    format: 'apache',
    regex: /(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/g,
  },
  {
    build: (match) => {
      const time = parseRfc5322Date(match[0]);

      return time === undefined ? undefined : { time };
    },
    format: 'rfc2822',
    regex:
      /[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (?:[+-]\d{4}|GMT|UTC?|[ECMP][SD]T)(?![\p{L}\p{N}_+-])/gu,
  },
  {
    build: buildSyslog,
    format: 'syslog',
    regex: /(?:^|(?<=\s))([A-Z][a-z]{2}) {1,2}(\d{1,2}) (\d{2}):(\d{2}):(\d{2})(?=\s|$)/g,
  },
  {
    build: buildSlashed,
    format: 'slashed',
    regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})/g,
  },
  {
    build: (match) => ({ fraction: match[0].slice(-3), time: Number(match[0]) }),
    format: 'unix-ms',
    regex: /(?<![\w.])([1-9]\d{12})(?![\w.])/g,
  },
  {
    build: (match) => {
      const { fraction, ms } = fractionMs(match[2]);

      return { fraction, time: Number(match[1]) * 1000 + ms };
    },
    format: 'unix-s',
    regex: /(?<![\w.])([1-9]\d{9})(?:\.(\d{1,9}))?(?![\w.])/g,
  },
];

export function parseApacheTime(value: string): number | undefined {
  const match = /^(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(
    value,
  );
  const month = match ? monthNumber(match[2]) : 0;
  const wall =
    match && month
      ? makeWall([String(month), match[1], match[4], match[5], match[6]], 0, Number(match[3]))
      : undefined;

  return wall && absolute(wall, offsetOf(match?.[7] ?? '+0000'));
}

export function findTimestamp(line: string, options: TimestampOptions): TimestampMatch | undefined {
  let best: TimestampMatch | undefined;

  for (const pattern of patterns) {
    if (best && pattern.format.startsWith('unix')) break;

    for (const match of line.matchAll(pattern.regex)) {
      const parsed = pattern.build(match, options);

      if (parsed === undefined || Number.isNaN(parsed.time)) continue;
      if (best === undefined || match.index < best.start) {
        best = {
          end: match.index + match[0].length,
          format: pattern.format,
          fraction: parsed.fraction,
          start: match.index,
          time: parsed.time,
        };
      }

      break;
    }
  }

  return best;
}
