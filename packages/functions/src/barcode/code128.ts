import { FunctionError } from '../errors';
import { code128Patterns } from './tables';

const digitRun = (text: string, from: number) => /^\d*/.exec(text.slice(from))?.[0].length ?? 0;
const startCodes = { A: 103, B: 104, C: 105 };
const isControl = (char: string) => char.charCodeAt(0) < 32;
const isLower = (char: string) => char.charCodeAt(0) >= 96;

function textSet(text: string, from: number): 'A' | 'B' {
  for (const char of text.slice(from)) {
    if (isControl(char)) return 'A';
    if (isLower(char)) return 'B';
  }

  return 'B';
}

function charValue(set: 'A' | 'B', char: string): number {
  const code = char.charCodeAt(0);

  return set === 'A' && code < 32 ? code + 64 : code - 32;
}

export function code128Codewords(text: string): number[] {
  if (text.length < 1 || text.length > 80) {
    throw new FunctionError('BARCODE_LENGTH', 'Code 128 input must be 1-80 characters.');
  }

  if (/[^\x00-\x7f]/.test(text)) {
    throw new FunctionError('BARCODE_CHARSET', 'Code 128 accepts ASCII characters 0-127 only.');
  }

  const leading = digitRun(text, 0);
  let set: 'A' | 'B' | 'C' =
    leading >= 4 || (leading === 2 && text.length === 2) ? 'C' : textSet(text, 0);
  const words = [startCodes[set]];
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);
    const digits = digitRun(text, index);

    if (set === 'C') {
      if (digits >= 2) {
        words.push(Number(text.slice(index, index + 2)));
        index += 2;
      } else {
        set = textSet(text, index);
        words.push(set === 'A' ? 101 : 100);
      }

      continue;
    }

    // Annex E: switch to C at 4+ digits at the end of the text, else 6+ (even) or 7+ (odd).
    const switchAt = index + digits === text.length ? 4 : 6 + (digits % 2);

    if (digits >= switchAt) {
      if (digits % 2 === 1) {
        words.push(charValue(set, char));
        index += 1;
      }

      words.push(99);
      set = 'C';

      continue;
    }

    if (set === 'B' && isControl(char)) {
      set = 'A';
      words.push(101);
    } else if (set === 'A' && isLower(char)) {
      set = 'B';
      words.push(100);
    }

    words.push(charValue(set, char));
    index += 1;
  }

  const check = words.reduce((sum, word, position) => sum + word * Math.max(position, 1), 0) % 103;

  return [...words, check, 106];
}

export const code128Modules = (words: number[]) =>
  words.map((word) => code128Patterns[word]).join('');
