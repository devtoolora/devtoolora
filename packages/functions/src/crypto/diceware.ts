import { FunctionError } from '../errors';
import { effWords } from './effWords';
import { randomBytes } from './primitives';

type DicewareFormat = {
  capitalize: boolean;
  digit: boolean;
  separator: 'dash' | 'none' | 'space' | 'underscore';
};

export type DicewareOptions = DicewareFormat & { count: number; words: number };

type DicewareResult = { bits: number; passphrases: string[] };

const MAX_COUNT = 20;
const MAX_ROLL_LINES = 1000;
const MAX_WORDS = 20;
const separators = { dash: '-', none: '', space: ' ', underscore: '_' };
const wordBits = Math.log2(effWords.length);

export function effWordForRoll(roll: string): string {
  if (!/^[1-6]{5}$/.test(roll))
    throw dicewareError(`"${roll.slice(0, 16)}" is not five dice digits 1-6.`);

  const index = [...roll].reduce((sum, digit) => sum * 6 + Number(digit) - 1, 0);

  return effWords[index] ?? '';
}

export function dicewareFromRolls(rolls: string, options: DicewareFormat): DicewareResult {
  const tokens = rolls.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) throw dicewareError('Enter at least one dice roll.');
  if (tokens.length > MAX_ROLL_LINES) throw dicewareError('Dice rolls exceed 1,000 lines.');

  const words = tokens.map((token, index) => {
    if (!/^[1-6]{5}$/.test(token))
      throw dicewareError(`Line ${index + 1} "${token.slice(0, 16)}" is not five dice digits 1-6.`);

    return effWordForRoll(token);
  });

  return {
    bits: roundBits(words.length * wordBits + (options.digit ? Math.log2(10) : 0)),
    passphrases: [format(words, options, createDraw(2))],
  };
}

export function generateDiceware(options: DicewareOptions): DicewareResult {
  assertRange(options.words, 'Words', MAX_WORDS);
  assertRange(options.count, 'Count', MAX_COUNT);

  const draw = createDraw(options.count * (options.words + 1));
  const passphrases = Array.from({ length: options.count }, () =>
    format(
      Array.from({ length: options.words }, () => effWords[draw(effWords.length)] ?? ''),
      options,
      draw,
    ),
  );

  return {
    bits: roundBits(options.words * wordBits + (options.digit ? Math.log2(10) : 0)),
    passphrases,
  };
}

function format(words: string[], options: DicewareFormat, draw: (limit: number) => number): string {
  const digitAfter = options.digit ? draw(words.length) : -1;
  const digit = options.digit ? draw(10) : 0;
  const parts = words.map((word, index) => {
    const text = options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;

    return index === digitAfter ? `${text}${digit}` : text;
  });

  return parts.join(separators[options.separator]);
}

function createDraw(expected: number): (limit: number) => number {
  let pool = randomBytes(Math.min(65536, expected * 6 + 64));
  let cursor = 0;

  const byte = (): number => {
    if (cursor >= pool.length) {
      pool = randomBytes(1024);
      cursor = 0;
    }

    return pool[cursor++] ?? 0;
  };

  return (limit) => {
    for (;;) {
      const value = limit > 256 ? (byte() << 5) | (byte() >> 3) : byte();
      const range = limit > 256 ? 8192 : 256;

      if (value < range - (range % limit)) return value % limit;
    }
  };
}

function assertRange(value: number, label: string, max: number): void {
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw dicewareError(`${label} must be an integer between 1 and ${max}.`);
}

function roundBits(bits: number): number {
  return Math.round(bits * 10) / 10;
}

function dicewareError(message: string): FunctionError {
  return new FunctionError('DICEWARE_ERROR', message);
}
