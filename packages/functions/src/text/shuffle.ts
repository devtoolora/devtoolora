import { FunctionError } from '../errors';

export type ShuffleOptions = {
  count?: number;
  mode: 'pick' | 'shuffle';
  random?: (maxExclusive: number) => number;
};
export type ShuffleResult = { inputLines: number; outputLines: number; text: string };

const maxUnits = 100_000;
const maxLines = 10_000;
const range = 2 ** 32;

function cryptoRandom(maxExclusive: number): number {
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);

  // Reject the uneven tail so every index has the same probability.
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while ((buffer[0] ?? 0) >= limit);

  return (buffer[0] ?? 0) % maxExclusive;
}

function splitLines(text: string): { endsWithTerminator: boolean; lines: string[] } {
  const lines = text.split(/\r\n|\r|\n/);
  const endsWithTerminator = lines.length > 1 && lines[lines.length - 1] === '';

  if (endsWithTerminator) lines.pop();

  return { endsWithTerminator, lines };
}

export function shuffleLines(text: string, options: ShuffleOptions): ShuffleResult {
  if (text.length > maxUnits)
    throw new FunctionError('INVALID_SHUFFLE', 'Input is limited to 100,000 UTF-16 units.');

  const { endsWithTerminator, lines } = splitLines(text);
  const inputLines = lines.length;
  const random = options.random ?? cryptoRandom;

  if (inputLines > maxLines)
    throw new FunctionError('INVALID_SHUFFLE', 'Input is limited to 10,000 lines.');

  const count = options.count ?? 1;

  if (options.mode === 'pick' && (!Number.isInteger(count) || count < 1 || count > inputLines))
    throw new FunctionError(
      'INVALID_SHUFFLE',
      `Count must be a whole number from 1 to ${inputLines}.`,
    );

  for (let index = inputLines - 1; index > 0; index -= 1) {
    const other = random(index + 1);
    const held = lines[index] as string;

    lines[index] = lines[other] as string;
    lines[other] = held;
  }

  const output = options.mode === 'pick' ? lines.slice(0, count) : lines;

  return {
    inputLines,
    outputLines: output.length,
    text: output.join('\n') + (endsWithTerminator ? '\n' : ''),
  };
}
