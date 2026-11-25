import { FunctionError } from '../errors/FunctionError';

const maxChars = 100_000;
const letterWords = [
  'Alfa',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliett',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
  'X-ray',
  'Yankee',
  'Zulu',
];
const digitWords = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const decodeTable = new Map<string, string>([
  ...letterWords.map((word, index): [string, string] => [
    word.toLowerCase(),
    String.fromCharCode(65 + index),
  ]),
  ...digitWords.map((word, index): [string, string] => [word.toLowerCase(), String(index)]),
  ['alpha', 'A'],
  ['juliet', 'J'],
  ['xray', 'X'],
  ['niner', '9'],
  ['nine', '9'],
]);

function assertLimit(text: string): void {
  if (text.length > maxChars)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 100,000 characters.');
}

function spellChar(char: string): string {
  if (char >= 'A' && char <= 'Z') return letterWords[char.charCodeAt(0) - 65] ?? char;

  if (char >= 'a' && char <= 'z') return letterWords[char.charCodeAt(0) - 97] ?? char;

  if (char >= '0' && char <= '9') return digitWords[char.charCodeAt(0) - 48] ?? char;

  return char === ' ' ? '/' : char;
}

export function spellNato(text: string): string {
  assertLimit(text);

  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/\r\n|\r|\n/)
    .map((line) => Array.from(line, spellChar).join(' '))
    .join('\n');
}

function decodeLine(line: string, lineNumber: number): string {
  let out = '';
  let index = 0;

  for (const token of line.split(/[ \t]+/)) {
    if (token === '') continue;

    index += 1;

    const decoded = decodeTable.get(token.toLowerCase());

    if (decoded !== undefined) out += decoded;
    else if (token === '/') out += ' ';
    else if (Array.from(token).length === 1 && !/[\p{L}\p{N}]/u.test(token)) out += token;
    else {
      const place = lineNumber === 1 ? '' : ` on line ${lineNumber}`;

      throw new FunctionError(
        'INVALID_INPUT',
        `Unknown code word "${token}" at word ${index}${place}.`,
      );
    }
  }

  return out;
}

export function decodeNato(text: string): string {
  assertLimit(text);

  return text
    .split(/\r\n|\r|\n/)
    .map((line, position) => decodeLine(line, position + 1))
    .join('\n');
}
