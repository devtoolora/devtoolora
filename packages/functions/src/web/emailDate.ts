const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const namedZones: Record<string, number> = {
  CDT: -300,
  CST: -360,
  EDT: -240,
  EST: -300,
  GMT: 0,
  MDT: -360,
  MST: -420,
  PDT: -420,
  PST: -480,
  UT: 0,
  UTC: 0,
  Z: 0,
};

const datePattern =
  /^(?:[A-Za-z]{3}\s*,\s*)?(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[A-Za-z]+)?$/;

function zoneMinutes(zone: string | undefined): number | undefined {
  if (zone === undefined) return undefined;

  if (/^[+-]\d{4}$/.test(zone)) {
    const minutes = Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3));

    return zone.startsWith('-') ? -minutes : minutes;
  }

  // Other alphabetic zones are read as -0000 (RFC 5322 section 4.3).
  return namedZones[zone.toUpperCase()] ?? 0;
}

export function parseRfc5322Date(value: string): number | undefined {
  const match = datePattern.exec(value.replace(/\([^()]*\)/g, ' ').trim());

  if (!match) return undefined;

  const [, day, monthName, rawYear = '', hour, minute, second = '0', zone] = match;
  const month = months.indexOf((monthName ?? '').toLowerCase());
  const offset = zoneMinutes(zone);

  if (month < 0 || offset === undefined) return undefined;

  let year = Number(rawYear);

  if (rawYear.length === 2) year += year < 50 ? 2000 : 1900;
  else if (rawYear.length === 3) year += 1900;

  const [d, h, m, s] = [Number(day), Number(hour), Number(minute), Number(second)];

  if (d === 0 || d > 31 || h > 23 || m > 59 || s > 60) return undefined;

  const time = Date.UTC(year, month, d, h, m, s);

  return new Date(time).getUTCDate() === d ? time - offset * 60_000 : undefined;
}

/** RFC 5322 §3.3: a day name must be the one the date implies, in the date's own zone. */
export function hasWrongWeekday(value: string): boolean {
  const text = value.replace(/\([^()]*\)/g, ' ').trim();
  const weekday = /^([A-Za-z]{3})\s*,/.exec(text)?.[1]?.toLowerCase();
  const time = parseRfc5322Date(value);

  if (weekday === undefined || time === undefined) return false;

  const offset = zoneMinutes(datePattern.exec(text)?.[7]) ?? 0;

  return weekdays[new Date(time + offset * 60_000).getUTCDay()] !== weekday;
}
