import { FunctionError } from '../errors/FunctionError';

export type CodePointRow = {
  category: string;
  char: string;
  codePoint: string;
  grapheme: number;
  index: number;
  utf16: string;
  utf8: string;
};

const maxCodePoints = 10_000;
const categoryNames: ReadonlyArray<readonly [string, string]> = [
  ['Lu', 'Uppercase Letter'],
  ['Ll', 'Lowercase Letter'],
  ['Lt', 'Titlecase Letter'],
  ['Lm', 'Modifier Letter'],
  ['Lo', 'Other Letter'],
  ['Mn', 'Nonspacing Mark'],
  ['Mc', 'Spacing Mark'],
  ['Me', 'Enclosing Mark'],
  ['Nd', 'Decimal Number'],
  ['Nl', 'Letter Number'],
  ['No', 'Other Number'],
  ['Pc', 'Connector Punctuation'],
  ['Pd', 'Dash Punctuation'],
  ['Ps', 'Open Punctuation'],
  ['Pe', 'Close Punctuation'],
  ['Pi', 'Initial Punctuation'],
  ['Pf', 'Final Punctuation'],
  ['Po', 'Other Punctuation'],
  ['Sm', 'Math Symbol'],
  ['Sc', 'Currency Symbol'],
  ['Sk', 'Modifier Symbol'],
  ['So', 'Other Symbol'],
  ['Zs', 'Space Separator'],
  ['Zl', 'Line Separator'],
  ['Zp', 'Paragraph Separator'],
  ['Cc', 'Control'],
  ['Cf', 'Format'],
  ['Cs', 'Surrogate'],
  ['Co', 'Private Use'],
  ['Cn', 'Unassigned'],
];
const categoryTests = categoryNames.map(
  ([code, name]) => [code, name, new RegExp(`^\\p{gc=${code}}$`, 'u')] as const,
);
const hiddenCategories = new Set(['Cc', 'Cf', 'Cs', 'Zl', 'Zp', 'Zs']);
const encoder = new TextEncoder();

function hex(value: number, width: number): string {
  return value.toString(16).toUpperCase().padStart(width, '0');
}

function categoryOf(char: string): [string, string] {
  for (const [code, name, test] of categoryTests) if (test.test(char)) return [code, name];

  return ['Cn', 'Unassigned'];
}

function displayChar(char: string, code: number, category: string): string {
  if (code < 0x20) return String.fromCodePoint(0x2400 + code);
  if (code === 0x20) return char;

  return hiddenCategories.has(category) ? '' : char;
}

function describeCodePoint(
  char: string,
  index: number,
  grapheme: number,
): { bytes: number; row: CodePointRow } {
  const code = char.codePointAt(0) ?? 0;
  const [categoryCode, categoryName] = categoryOf(char);
  const lone = categoryCode === 'Cs';
  const utf8 = lone ? [] : [...encoder.encode(char)];
  const units = Array.from({ length: char.length }, (_, i) => char.charCodeAt(i));

  return {
    bytes: utf8.length,
    row: {
      category: `${categoryCode} ${categoryName}`,
      char: displayChar(char, code, categoryCode),
      codePoint: `U+${hex(code, 4)}`,
      grapheme,
      index,
      utf16: units.map((unit) => hex(unit, 4)).join(' '),
      utf8: lone ? 'invalid (lone surrogate)' : utf8.map((byte) => hex(byte, 2)).join(' '),
    },
  };
}

function assertWithinLimit(text: string): void {
  if (text.length <= maxCodePoints) return;

  const chars = text[Symbol.iterator]();

  for (let count = 0; count <= maxCodePoints; count += 1) {
    if (chars.next().done) return;
  }

  throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 10,000 code points.');
}

export function inspectUnicode(text: string): {
  bytes: number;
  graphemes: number;
  rows: CodePointRow[];
} {
  assertWithinLimit(text);

  const rows: CodePointRow[] = [];
  let bytes = 0;
  let graphemes = 0;

  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
    text,
  )) {
    graphemes += 1;

    for (const char of segment) {
      const described = describeCodePoint(char, rows.length + 1, graphemes);

      bytes += described.bytes;
      rows.push(described.row);
    }
  }

  return { bytes, graphemes, rows };
}
