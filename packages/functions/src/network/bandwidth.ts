import { describeDuration } from '../datetime/duration';
import { listMeasurementUnits } from '../measurement/units';
import { formatDouble } from '../math/shared';
import { networkError } from './shared';

export interface TransferOptions {
  overheadPercent: number;
  rate?: number;
  rateUnit: string;
  size?: number;
  sizeUnit: string;
  solveFor: 'rate' | 'size' | 'time';
  time?: number;
  timeUnit: 's' | 'min' | 'h' | 'd';
}

export interface TransferResult {
  summary: string;
  text: string;
  value: number;
}

const sizeFactors: Array<[string, number]> = [
  ...listMeasurementUnits()
    .filter((unit) => unit.dimension === 'storage')
    .map((unit): [string, number] => [unit.symbol, unit.scale]),
  ['bit', 1 / 8],
  ['kbit', 125],
  ['Mbit', 125e3],
  ['Gbit', 125e6],
];
const rateFactors: Array<[string, number]> = [
  ['bit/s', 1 / 8],
  ['kbit/s', 125],
  ['Mbit/s', 125e3],
  ['Gbit/s', 125e6],
  ['B/s', 1],
  ['kB/s', 1e3],
  ['MB/s', 1e6],
  ['GB/s', 1e9],
  ['KiB/s', 2 ** 10],
  ['MiB/s', 2 ** 20],
  ['GiB/s', 2 ** 30],
];
const timeFactors: Array<[string, number]> = [
  ['s', 1],
  ['min', 60],
  ['h', 3600],
  ['d', 86400],
];

function factorOf(table: Array<[string, number]>, unit: string, label: string): number {
  const found = table.find(([symbol]) => symbol === unit);

  if (found === undefined) throw networkError('INVALID_UNIT', `Choose a valid ${label} unit.`);

  return found[1];
}

function positive(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0)
    throw networkError('INVALID_NUMBER', `${label} must be above zero.`);

  return value;
}

function rows(entries: Array<[string, string]>): string {
  const width = Math.max(...entries.map(([label]) => label.length)) + 2;

  return `${entries.map(([label, value]) => label.padEnd(width) + value).join('\n')}\n`;
}

function unitRows(table: Array<[string, number]>, value: number): Array<[string, string]> {
  return table.map(([symbol, factor]) => [symbol, formatDouble(value / factor)]);
}

function solve(
  options: TransferOptions,
  share: number,
): { bps: number; bytes: number; seconds: number } {
  const sizeFactor = factorOf(sizeFactors, options.sizeUnit, 'size');
  const rateFactor = factorOf(rateFactors, options.rateUnit, 'rate');
  const timeFactor = factorOf(timeFactors, options.timeUnit, 'time');

  if (options.solveFor === 'time') {
    const bytes = positive(options.size, 'Size') * sizeFactor;
    const bps = positive(options.rate, 'Rate') * rateFactor;

    return { bps, bytes, seconds: bytes / (bps * share) };
  }

  if (options.solveFor === 'size') {
    const seconds = positive(options.time, 'Time') * timeFactor;
    const bps = positive(options.rate, 'Rate') * rateFactor;

    return { bps, bytes: bps * share * seconds, seconds };
  }

  const bytes = positive(options.size, 'Size') * sizeFactor;
  const seconds = positive(options.time, 'Time') * timeFactor;

  return { bps: bytes / seconds / share, bytes, seconds };
}

export function calculateTransfer(options: TransferOptions): TransferResult {
  if (
    !Number.isFinite(options.overheadPercent) ||
    options.overheadPercent < 0 ||
    options.overheadPercent >= 100
  )
    throw networkError('INVALID_OVERHEAD', 'Overhead must be within 0-99 %.');

  const share = 1 - options.overheadPercent / 100;
  const { bps, bytes, seconds } = solve(options, share);
  const value = { rate: bps, size: bytes, time: seconds }[options.solveFor];

  if (!Number.isFinite(value) || value <= 0)
    throw networkError('RESULT_OUT_OF_RANGE', 'The result is outside the range that can be shown.');

  const rateFactor = factorOf(rateFactors, options.rateUnit, 'rate');
  const human = describeDuration(Math.round(seconds * 1000)).human;
  const entries: Array<[string, string]> =
    options.solveFor === 'time'
      ? [
          ['Time', human],
          ...unitRows(timeFactors, seconds).map(([s, v]): [string, string] => [
            { s: 'Seconds', min: 'Minutes', h: 'Hours', d: 'Days' }[s] ?? s,
            v,
          ]),
        ]
      : unitRows(options.solveFor === 'size' ? sizeFactors : rateFactors, value);

  if (options.overheadPercent > 0)
    entries.push([
      'Effective rate',
      `${formatDouble((bps * share) / rateFactor)} ${options.rateUnit}`,
    ]);

  const headline = {
    rate: `${formatDouble(bps / rateFactor)} ${options.rateUnit}`,
    size: `${formatDouble(bytes / factorOf(sizeFactors, options.sizeUnit, 'size'))} ${options.sizeUnit}`,
    time: human,
  }[options.solveFor];

  return { summary: headline, text: rows(entries), value };
}
