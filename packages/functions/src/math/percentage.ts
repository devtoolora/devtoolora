import { mathError } from './shared';

export type PercentageOptions =
  | { mode: 'percent-of'; percent: number; value: number }
  | { mode: 'what-percent'; part: number; total: number }
  | { mode: 'percent-change'; newValue: number; oldValue: number }
  | { mode: 'add-percent'; percent: number; value: number };

export type PercentageResult = {
  changeAmount?: number;
  direction?: 'increase' | 'decrease' | 'no change';
  formula: string;
  mode: string;
  result: number | { decreased: number; increased: number };
};

type Decimal = { digits: bigint; exponent: number };

// String() gives the shortest decimal for a double: 19.99 here is 1999e-2, with no binary error.
function toDecimal(value: number): Decimal {
  if (!Number.isFinite(value)) throw mathError('Percentage result exceeds the numeric range.');

  const [mantissa = '0', exponent = '0'] = String(value).split('e');
  const [whole = '', fraction = ''] = mantissa.split('.');

  return { digits: BigInt(whole + fraction), exponent: Number(exponent) - fraction.length };
}

function alignedDigits(left: number, right: number): [bigint, bigint, number] {
  const [a, b] = [toDecimal(left), toDecimal(right)];
  const exponent = Math.min(a.exponent, b.exponent);

  return [
    a.digits * 10n ** BigInt(a.exponent - exponent),
    b.digits * 10n ** BigInt(b.exponent - exponent),
    exponent,
  ];
}

function percentOf(percent: number, value: number): number {
  const [a, b] = [toDecimal(percent), toDecimal(value)];

  return Number(`${a.digits * b.digits}e${a.exponent + b.exponent - 2}`);
}

function difference(left: number, right: number): number {
  const [a, b, exponent] = alignedDigits(left, right);

  return Number(`${a - b}e${exponent}`);
}

function percentOfTotal(part: number, total: number): number {
  const [a, b] = alignedDigits(part, total);

  return Number(a * 100n) / Number(b);
}

function changeDirection(result: number): 'increase' | 'decrease' | 'no change' {
  if (result > 0) return 'increase';
  if (result < 0) return 'decrease';

  return 'no change';
}

export function calculatePercentage(options: PercentageOptions): PercentageResult {
  if (Object.values(options).some((value) => typeof value === 'number' && !Number.isFinite(value)))
    throw mathError('Percentage inputs must be finite numbers.');

  const report = percentageReport(options);
  const numbers =
    typeof report.result === 'number'
      ? [report.result, report.changeAmount ?? 0]
      : Object.values(report.result);

  if (!numbers.every(Number.isFinite))
    throw mathError('Percentage result exceeds the numeric range.');

  return report;
}

function percentageReport(options: PercentageOptions): PercentageResult {
  switch (options.mode) {
    case 'percent-of':
      return {
        mode: options.mode,
        formula: `${options.percent}% of ${options.value}`,
        result: percentOf(options.percent, options.value),
      };
    case 'what-percent':
      if (options.total === 0) throw mathError('Total must not be zero.');

      return {
        mode: options.mode,
        formula: `${options.part} / ${options.total} * 100`,
        result: percentOfTotal(options.part, options.total),
      };

    case 'percent-change': {
      if (options.oldValue === 0) throw mathError('Old value must not be zero.');
      if (options.oldValue < 0)
        throw mathError(
          'Percent change requires a positive old value; a negative baseline has ambiguous interpretation.',
        );

      const changeAmount = difference(options.newValue, options.oldValue);
      const result = percentOfTotal(changeAmount, options.oldValue);

      return {
        mode: options.mode,
        formula: `(${options.newValue} - ${options.oldValue}) / ${options.oldValue} * 100`,
        result,
        direction: changeDirection(result),
        changeAmount,
      };
    }

    case 'add-percent': {
      const delta = percentOf(options.percent, options.value);

      return {
        mode: options.mode,
        formula: `${options.value} +/- ${options.percent}%`,
        result: {
          increased: difference(options.value, -delta),
          decreased: difference(options.value, delta),
        },
      };
    }

    default:
      throw mathError('Choose a supported percentage calculation.');
  }
}
