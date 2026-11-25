import { FunctionError } from '../errors';

export type PathLetter = 'M' | 'L' | 'H' | 'V' | 'C' | 'S' | 'Q' | 'T' | 'A' | 'Z';

export type PathSegment = {
  explicit: boolean;
  letter: PathLetter;
  relative: boolean;
  values: number[];
};

const PATH_VALUE_COUNTS: Record<PathLetter, number> = {
  A: 7,
  C: 6,
  H: 1,
  L: 2,
  M: 2,
  Q: 4,
  S: 4,
  T: 2,
  V: 1,
  Z: 0,
};

const MAX_CHARACTERS = 100_000;
const MAX_SEGMENTS = 20_000;

const isDigit = (code: number) => code >= 48 && code <= 57;
// SVG whitespace: space, tab, LF, FF, CR (not VT).
const isSpace = (code: number) =>
  code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
const isPathLetter = (letter: string): letter is PathLetter => letter in PATH_VALUE_COUNTS;

class Scanner {
  pos = 0;

  constructor(readonly text: string) {}

  get done() {
    return this.pos >= this.text.length;
  }

  fail(expected: string): never {
    throw new FunctionError(
      'SVG_PATH_ERROR',
      `Invalid path data at character ${this.pos + 1}: expected ${expected}.`,
    );
  }

  skip() {
    while (!this.done && isSpace(this.text.charCodeAt(this.pos))) this.pos += 1;
  }

  separator() {
    this.skip();

    if (this.text[this.pos] === ',') {
      this.pos += 1;
      this.skip();
    }
  }

  private digits() {
    const start = this.pos;

    while (!this.done && isDigit(this.text.charCodeAt(this.pos))) this.pos += 1;

    return this.pos - start;
  }

  private sign() {
    if (this.text[this.pos] === '+' || this.text[this.pos] === '-') this.pos += 1;
  }

  number(first = true): number {
    if (first) this.skip();
    else this.separator();

    const start = this.pos;

    this.sign();

    let count = this.digits();

    if (this.text[this.pos] === '.') {
      this.pos += 1;
      count += this.digits();
    }

    if (count === 0) return this.fail('a number');

    if (this.text[this.pos] === 'e' || this.text[this.pos] === 'E') {
      const mark = this.pos;

      this.pos += 1;
      this.sign();
      if (this.digits() === 0) this.pos = mark;
    }

    const value = Number(this.text.slice(start, this.pos));

    if (!Number.isFinite(value)) {
      this.pos = start;

      return this.fail('a number in range');
    }

    return value;
  }

  flag(first = true): number {
    if (first) this.skip();
    else this.separator();

    const flag = this.text[this.pos];

    if (flag !== '0' && flag !== '1') return this.fail('a flag (0 or 1)');

    this.pos += 1;

    return Number(flag);
  }
}

function readSegment(scan: Scanner, previous: PathSegment | undefined): PathSegment {
  const char = scan.text.charAt(scan.pos);
  const upper = char.toUpperCase();
  let letter: PathLetter;
  let relative: boolean;
  let explicit = true;

  if (/[a-zA-Z]/.test(char) && isPathLetter(upper)) {
    if (!previous && upper !== 'M') scan.fail('a command');

    letter = upper;
    relative = char !== upper;
    scan.pos += 1;
  } else if (previous && previous.letter !== 'Z' && /[-+.0-9]/.test(char)) {
    letter = previous.letter === 'M' ? 'L' : previous.letter;
    relative = previous.relative;
    explicit = false;
  } else {
    return scan.fail('a command');
  }

  const values: number[] = [];

  for (let index = 0; index < PATH_VALUE_COUNTS[letter]; index += 1) {
    const first = index === 0;

    values.push(
      letter === 'A' && (index === 3 || index === 4) ? scan.flag(first) : scan.number(first),
    );
  }

  return { explicit, letter, relative, values };
}

export function parsePathData(text: string): PathSegment[] {
  if (text.length > MAX_CHARACTERS) {
    throw new FunctionError('SVG_PATH_ERROR', 'Path data is longer than 100,000 characters.');
  }

  const scan = new Scanner(text);
  const segments: PathSegment[] = [];

  for (;;) {
    scan.skip();
    if (scan.done) return segments;

    if (scan.text[scan.pos] === ',' && segments.length > 0) {
      // A comma may separate an implicit repetition from the previous values.
      scan.separator();
      if (scan.done || !/[-+.0-9]/.test(scan.text.charAt(scan.pos))) scan.fail('a number');
    }

    if (segments.length >= MAX_SEGMENTS) {
      throw new FunctionError('SVG_PATH_ERROR', 'Path has more than 20,000 segments.');
    }

    segments.push(readSegment(scan, segments[segments.length - 1]));
  }
}
