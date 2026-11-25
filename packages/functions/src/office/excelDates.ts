/** `duration` is elapsed time ([h], [m], [s]): hours do not wrap at 24. */
export type DateKind = 'date' | 'datetime' | 'duration' | 'time';

const secondsPerDay = 86_400;
const dayMs = secondsPerDay * 1000;
// 9999-12-31 is Excel's last day; later serials are not dates.
const maxSerial = 2_958_465;
const epoch1900 = Date.UTC(1899, 11, 30);
const epoch1900Early = Date.UTC(1899, 11, 31);
const epoch1904 = Date.UTC(1904, 0, 1);
const pad = (value: number, width: number = 2): string => String(value).padStart(width, '0');

function clock(seconds: number): string {
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function calendar(ms: number): string {
  const date = new Date(ms);

  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function excelSerialToIso(
  serial: number,
  kind: DateKind,
  date1904: boolean,
): string | undefined {
  if (!Number.isFinite(serial) || serial < 0 || serial > maxSerial) return undefined;
  if (kind !== 'time' && kind !== 'duration' && serial < (date1904 ? 0 : 1)) return undefined;

  const total = Math.round(serial * secondsPerDay);
  const day = Math.floor(total / secondsPerDay);
  const time = clock(total % secondsPerDay);

  if (kind === 'duration') return clock(total);
  if (kind === 'time') return time;

  // The 1900 system counts a 1900-02-29 that never existed (serial 60).
  let ms = date1904 ? epoch1904 : epoch1900;

  if (!date1904 && day < 61) ms = epoch1900Early;

  const date = !date1904 && day === 60 ? '1900-02-29' : calendar(ms + day * dayMs);

  return kind === 'date' ? date : `${date}T${time}`;
}

export function dateFormatKind(code: string): DateKind | undefined {
  const plain = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/[_*]./g, '');

  if (
    /\[(?:h+|m+|s+)\]/i.test(plain.split(';')[0] ?? '') &&
    !/[yd]/i.test(plain.replace(/\[[^\]]*\]/g, ''))
  )
    return 'duration';

  const section = plain
    .replace(/am\/pm|a\/p/gi, '')
    .replace(/\[([hms]+)\]/gi, '$1')
    .replace(/\[[^\]]*\]/g, '')
    .split(';')[0]
    ?.toLowerCase();

  if (!section) return undefined;

  const hasTime = /[hs]/.test(section);
  // An m next to a time part is minutes; without one it is the month.
  const hasDate = /[yd]/.test(section) || (!hasTime && section.includes('m'));

  if (hasDate && hasTime) return 'datetime';
  if (hasDate) return 'date';

  return hasTime || section.includes('m') ? 'time' : undefined;
}

export function isoToExcelSerial(iso: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(iso);

  if (!match) return undefined;

  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  // Date.UTC maps years 0-99 to 1900-1999, so the year is set separately.
  const date = new Date(0);

  date.setUTCFullYear(year ?? 0, (month ?? 1) - 1, day ?? 1);

  if (date.getUTCMonth() !== (month ?? 1) - 1 || date.getUTCDate() !== day) return undefined;
  if ((hour ?? 0) > 23 || (minute ?? 0) > 59 || (second ?? 0) > 59) return undefined;

  const days = Math.round((date.getTime() - epoch1900) / dayMs);

  if ((year ?? 0) < 1900 || days < 61) return undefined;

  return days + ((hour ?? 0) * 3600 + (minute ?? 0) * 60 + (second ?? 0)) / secondsPerDay;
}
