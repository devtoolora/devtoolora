import { FunctionError } from '../errors';
import { convertTimestamp, resolveTimeZone } from '../web/time';
import { formatYear } from '../web/timeWall';

export type TimeZoneRow = { dayShift: number; local: string; offset: string; zone: string };
export type TimeZoneConversion = { instant: string; notes?: string[]; rows: TimeZoneRow[] };

const maxZones = 50;

type Wall = { date: string; dayNumber: number; offsetMinutes: number; time: string };

function wallClock(instant: number, zone: string): Wall {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      era: 'short',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
      timeZone: zone,
      timeZoneName: 'longOffset',
      year: 'numeric',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const match = /([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName ?? '');
  const offsetMinutes = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0;

  // 1 BC is ISO year 0, and the year part alone counts backwards without the era.
  const year = /^B/i.test(parts.era ?? '') ? 1 - Number(parts.year) : Number(parts.year);

  return {
    date: `${formatYear(year)}-${parts.month}-${parts.day}`,
    dayNumber: Math.floor((instant + offsetMinutes * 60_000) / 86_400_000),
    offsetMinutes,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function formatOffset(minutes: number): string {
  const abs = Math.abs(minutes);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${minutes < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function convertTimeZones(
  input: string,
  options: { fromZone: string; now?: Date; zones: string[] },
): TimeZoneConversion {
  const zones = options.zones.map((zone) => zone.trim()).filter(Boolean);

  if (zones.length === 0)
    throw new FunctionError('NO_TIME_ZONES', 'Enter at least one time zone to convert to.');

  if (zones.length > maxZones)
    throw new FunctionError('TOO_MANY_TIME_ZONES', `Convert to at most ${maxZones} time zones.`);

  const fromZone = resolveTimeZone(options.fromZone.trim() || 'local');
  const resolved = zones.map((zone) => [zone, resolveTimeZone(zone)] as const);
  const parsed = convertTimestamp(input, { now: options.now, timeZone: fromZone });
  const instant = parsed.unixMilliseconds;
  const origin = wallClock(instant, fromZone).dayNumber;

  return {
    instant: parsed.iso,
    ...(parsed.notes ? { notes: parsed.notes } : {}),
    rows: resolved.map(([zone, name]) => {
      const wall = wallClock(instant, name);

      return {
        dayShift: wall.dayNumber - origin,
        local: `${wall.date} ${wall.time}`,
        offset: formatOffset(wall.offsetMinutes),
        zone,
      };
    }),
  };
}
