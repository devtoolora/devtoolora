import { offsetMinutes, formatOffset, formatWall, wallTime } from '../web/timeWall';
import { resolveTimeZone } from '../web/time';
import { checkLogInput, logError } from './shared';
import { findTimestamp, type TimestampMatch } from './timestamps';

export type NormalizeOptions = {
  dateOrder: 'dmy' | 'mdy';
  mode: 'prefix' | 'replace';
  target: 'iso-utc' | 'iso-zone' | 'unix-ms' | 'unix-s';
  timeZone: string;
  year: number;
};

const maxLines = 100_000;

function formatTime(match: TimestampMatch, options: NormalizeOptions): string {
  const { fraction, time } = match;

  if (options.target === 'unix-ms') return String(time);
  if (options.target === 'unix-s') return String(Math.floor(time / 1000));

  const suffix = fraction === undefined ? '' : `.${fraction}`;

  if (options.target === 'iso-utc') {
    return `${new Date(time).toISOString().slice(0, 19)}${suffix}Z`;
  }

  const wall = { ...wallTime(time, options.timeZone), millisecond: 0 };

  return `${formatWall(wall)}${suffix}${formatOffset(offsetMinutes(time, options.timeZone), ':')}`;
}

export function normalizeLogTimestamps(
  text: string,
  options: NormalizeOptions,
): { formats: string[]; normalized: number; text: string; unchanged: number } {
  if (!Number.isInteger(options.year) || options.year < 1970 || options.year > 2100) {
    throw logError('Year must be between 1970 and 2100.');
  }

  const timeZone = resolveTimeZone(options.timeZone);

  checkLogInput(text);

  const lines = text.split('\n');

  if (lines.length > maxLines) throw logError('Log input exceeds 100,000 lines.');

  const formats = new Set<string>();
  let normalized = 0;
  const output = lines.map((line) => {
    const match = findTimestamp(line, { ...options, timeZone });

    if (!match) return line;

    normalized += 1;
    formats.add(match.format);

    const value = formatTime(match, { ...options, timeZone });

    return options.mode === 'prefix'
      ? `${value}\t${line}`
      : `${line.slice(0, match.start)}${value}${line.slice(match.end)}`;
  });

  return {
    formats: [...formats].sort(),
    normalized,
    text: output.join('\n'),
    unchanged: lines.length - normalized - (lines.at(-1) === '' && lines.length > 1 ? 1 : 0),
  };
}
