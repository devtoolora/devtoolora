import { randomBytes } from '../crypto/primitives';
import { mathError } from './shared';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_COUNT = 10_000;
const MAX_PLACES = 15;

export interface IntegerOptions {
  count: number;
  max: string;
  min: string;
  sorted: boolean;
  unique: boolean;
}

export interface DecimalOptions {
  count: number;
  max: string;
  min: string;
  places: number;
}

export interface DiceResult {
  rolls: Array<{ dice: number[]; total: number }>;
  text: string;
}

/** Unbiased value in [0, limit): mask to the bit length of limit - 1 and reject values >= limit. */
export function randomBelow(limit: bigint): bigint {
  if (limit < 1n) throw mathError('Random limit must be at least 1.');

  if (limit === 1n) return 0n;

  const bits = (limit - 1n).toString(2).length;
  const mask = (1n << BigInt(bits)) - 1n;
  const length = Math.ceil(bits / 8) || 1;

  for (;;) {
    let value = 0n;

    for (const byte of randomBytes(length)) value = (value << 8n) | BigInt(byte);

    value &= mask;

    if (value < limit) return value;
  }
}

function checkCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw mathError('Count must be a whole number within 1-10,000.');
  }
}

function parseInteger(value: string, label: string): bigint {
  const text = value.trim();

  if (!/^[+-]?\d{1,20}$/.test(text)) throw mathError(`${label} must be a whole number.`);

  const parsed = BigInt(text);

  if (parsed > MAX_SAFE || parsed < -MAX_SAFE) {
    throw mathError(`${label} must be within ±(2^53 - 1).`);
  }

  return parsed;
}

function uniqueIntegers(min: bigint, span: bigint, count: number): number[] {
  if (span <= BigInt(count) * 4n) {
    const pool = Array.from({ length: Number(span) }, (_, index) => Number(min) + index);

    for (let index = 0; index < count; index += 1) {
      const pick = index + Number(randomBelow(BigInt(pool.length - index)));
      const swap = pool[index] as number;

      pool[index] = pool[pick] as number;
      pool[pick] = swap;
    }

    return pool.slice(0, count);
  }

  const seen = new Set<number>();

  while (seen.size < count) seen.add(Number(min + randomBelow(span)));

  return [...seen];
}

export function randomIntegers(options: IntegerOptions): number[] {
  checkCount(options.count);

  const min = parseInteger(options.min, 'Min');
  const max = parseInteger(options.max, 'Max');

  if (min > max) throw mathError('Min must not exceed max.');

  const span = max - min + 1n;

  if (options.unique && span < BigInt(options.count)) {
    throw mathError(`Only ${span} distinct values exist in this range.`);
  }

  const values = options.unique
    ? uniqueIntegers(min, span, options.count)
    : Array.from({ length: options.count }, () => Number(min + randomBelow(span)));

  return options.sorted ? values.sort((a, b) => a - b) : values;
}

function scaled(value: string, label: string, places: number): bigint {
  const match = /^([+-]?)(\d{1,30})(?:\.(\d{1,30}))?$/.exec(value.trim());

  if (!match) throw mathError(`${label} must be a decimal number.`);

  const fraction = match[3] ?? '';

  if (fraction.length > places) {
    throw mathError(`${label} has more than ${places} decimal places.`);
  }

  const units = BigInt(`${match[2]}${fraction.padEnd(places, '0')}`);

  return match[1] === '-' ? -units : units;
}

function formatScaled(value: bigint, places: number): string {
  const digits = (value < 0n ? -value : value).toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const fraction = places > 0 ? `.${digits.slice(digits.length - places)}` : '';

  return `${value < 0n ? '-' : ''}${whole}${fraction}`;
}

export function randomDecimals(options: DecimalOptions): string[] {
  checkCount(options.count);

  if (!Number.isInteger(options.places) || options.places < 0 || options.places > MAX_PLACES) {
    throw mathError('Decimal places must be a whole number within 0-15.');
  }

  const min = scaled(options.min, 'Min', options.places);
  const max = scaled(options.max, 'Max', options.places);

  if (min > max) throw mathError('Min must not exceed max.');

  return Array.from({ length: options.count }, () =>
    formatScaled(min + randomBelow(max - min + 1n), options.places),
  );
}

export function rollDice(notation: string, rolls: number): DiceResult {
  const match = /^(\d+)d(\d+)(?:([+-])(\d+))?$/i.exec(notation.trim());

  if (!match) throw mathError('Dice notation must look like NdM, NdM+K or NdM-K, e.g. 2d6+3.');

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0;

  if (Math.abs(modifier) > 1_000_000) throw mathError('Dice modifier must be within ±1,000,000.');

  if (count < 1 || count > 100) throw mathError('Dice count must be within 1-100 dice.');

  if (sides < 2 || sides > 1000) throw mathError('Dice must have 2-1,000 sides.');

  if (!Number.isInteger(rolls) || rolls < 1 || rolls > 1000) {
    throw mathError('Rolls must be a whole number within 1-1,000 rolls.');
  }

  const label = `${count}d${sides}${match[3] ? `${match[3]}${match[4]}` : ''}`;
  const suffix = match[3] ? ` ${match[3]} ${match[4]}` : '';
  const results = Array.from({ length: rolls }, () => {
    const dice = Array.from({ length: count }, () => Number(randomBelow(BigInt(sides))) + 1);

    return { dice, total: dice.reduce((sum, die) => sum + die, 0) + modifier };
  });
  const text = results
    .map((roll) => `${label}: [${roll.dice.join(', ')}]${suffix} = ${roll.total}\n`)
    .join('');

  return { rolls: results, text };
}
