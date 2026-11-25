import { formatDouble, mathError, required } from './shared';

const maxInputLength = 5_000_000;
const maxNumbers = 100_000;
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const rangeMessage = 'The sum or variance exceeds the double range.';
// These rows repeat an input value, so there is no float noise to round away.
const inputValueKeys = new Set(['max', 'min', 'mode']);

export interface NumberDescription {
  count: number;
  json: Record<string, number | number[] | null>;
  text: string;
}

export interface DescribeOptions {
  percentile?: number;
}

function parseNumbers(text: string): number[] {
  const input = required(text, 'Number list');

  if (input.length > maxInputLength) {
    throw mathError('Input is limited to 5,000,000 characters.');
  }

  const tokens = input.split(/[\s,;]+/).filter(Boolean);

  if (tokens.length === 0) throw mathError('A list of numbers is required.');

  if (tokens.length > maxNumbers) throw mathError('Input is limited to 100,000 numbers.');

  return tokens.map((token, index) => {
    const value = Number(token);

    if (!numberPattern.test(token) || !Number.isFinite(value)) {
      throw mathError(`"${token}" at position ${index + 1} is not a finite decimal number.`);
    }

    return value;
  });
}

function sumOf(values: readonly number[]): number {
  let sum = 0;
  let compensation = 0;

  for (const value of values) {
    const total = sum + value;

    compensation += Math.abs(sum) >= Math.abs(value) ? sum - total + value : value - total + sum;
    sum = total;
  }

  return sum + compensation;
}

function populationVariance(values: readonly number[]): number {
  let mean = 0;
  let m2 = 0;

  values.forEach((value, index) => {
    const delta = value - mean;

    mean += delta / (index + 1);
    m2 += delta * (value - mean);
  });

  return m2 / values.length;
}

// Linear interpolation between closest ranks (Excel PERCENTILE.INC, NumPy default).
function percentileOf(sorted: readonly number[], percent: number): number {
  const rank = ((sorted.length - 1) * percent) / 100;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const lower = sorted[low] ?? 0;
  const upper = sorted[high] ?? 0;

  return lower + (upper - lower) * (rank - low);
}

function modeOf(sorted: readonly number[]): number[] | null {
  const counts = new Map<number, number>();

  for (const value of sorted) counts.set(value, (counts.get(value) ?? 0) + 1);

  let top = 0;

  for (const count of counts.values()) if (count > top) top = count;

  if (top < 2) return null;

  return [...counts].filter(([, count]) => count === top).map(([value]) => value);
}

function geometricMeanOf(values: readonly number[]): number | null {
  if (values.some((value) => value <= 0)) return null;

  return Math.exp(sumOf(values.map(Math.log)) / values.length);
}

export function describeNumbers(text: string, options: DescribeOptions = {}): NumberDescription {
  const custom = options.percentile;

  if (custom !== undefined && !(Number.isFinite(custom) && custom >= 0 && custom <= 100)) {
    throw mathError('Custom percentile must be a number from 0 to 100.');
  }

  const values = parseNumbers(text);
  const count = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sumOf(values);
  const variance = populationVariance(values);

  if (!Number.isFinite(sum) || !Number.isFinite(variance)) throw mathError(rangeMessage);

  const min = sorted[0] ?? 0;
  const max = sorted[count - 1] ?? 0;
  const sampleVariance = count > 1 ? (variance * count) / (count - 1) : null;
  const percentiles: Array<[string, number]> = [25, 50, 75, 90, 95, 99].map((p) => [
    `${p}`,
    percentileOf(sorted, p),
  ]);

  if (options.percentile !== undefined) {
    percentiles.push([formatDouble(options.percentile), percentileOf(sorted, options.percentile)]);
  }

  const mode = modeOf(sorted);
  const rows: Array<[string, string, number | number[] | null, string | null]> = [
    ['Count', 'count', count, null],
    ['Sum', 'sum', sum, null],
    ['Min', 'min', min, null],
    ['Max', 'max', max, null],
    ['Range', 'range', max - min, null],
    ['Mean', 'mean', sum / count, null],
    ['Median', 'median', percentileOf(sorted, 50), null],
    ['Mode', 'mode', mode, mode ? mode.join(', ') : 'none'],
    ['Population variance', 'populationVariance', variance, null],
    ['Population std dev', 'populationStdDev', Math.sqrt(variance), null],
    ['Sample variance', 'sampleVariance', sampleVariance, null],
    [
      'Sample std dev',
      'sampleStdDev',
      sampleVariance === null ? null : Math.sqrt(sampleVariance),
      null,
    ],
  ];

  const percentileRows = percentiles.map(([name, value]): [string, string, number, null] => [
    `P${name}`,
    `p${name}`,
    value,
    null,
  ]);

  rows.push(...percentileRows);
  rows.push(['IQR', 'iqr', percentileOf(sorted, 75) - percentileOf(sorted, 25), null]);
  rows.push(['Geometric mean', 'geometricMean', geometricMeanOf(values), null]);

  return render(rows, count);
}

function roundJson(value: number | number[] | null): number | number[] | null {
  if (value === null) return null;

  return Array.isArray(value) ? value.map(roundJson1) : roundJson1(value);
}

function roundJson1(value: number): number {
  return Number(formatDouble(value));
}

function render(
  rows: Array<[string, string, number | number[] | null, string | null]>,
  count: number,
): NumberDescription {
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  const json: Record<string, number | number[] | null> = {};
  let text = '';

  for (const [label, key, value, display] of rows) {
    const isInputValue = inputValueKeys.has(key);

    json[key] = isInputValue ? value : roundJson(value);
    if (value === null && display === null) continue;

    text += `${label.padEnd(width)}${display ?? (isInputValue ? String(value) : formatDouble(Number(value)))}\n`;
  }

  return { count, json, text };
}
