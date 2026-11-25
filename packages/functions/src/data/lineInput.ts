import { FunctionError } from '../errors';

export function nonBlankLines(text: string): string[] {
  if (text.length > 40_000)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input exceeds 40,000 characters.');

  const lines: string[] = [];
  let number = 0;

  for (let start = 0; start <= text.length;) {
    const found = text.indexOf('\n', start);
    const end = found === -1 ? text.length : found;
    const line = text.slice(start, end).replace(/\r$/, '');

    number += 1;
    start = end + 1;

    if (line.trim()) {
      if (lines.length >= 1_000)
        throw new FunctionError('INPUT_TOO_LARGE', 'Input exceeds 1,000 lines.');

      if (line.length > 32)
        throw new FunctionError('INPUT_TOO_LARGE', `Line ${number} exceeds 32 characters.`);

      lines.push(line);
    }
  }

  return lines;
}
