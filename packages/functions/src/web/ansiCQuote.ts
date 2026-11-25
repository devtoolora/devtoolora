import { webError } from './webInput';

const namedEscapes: Record<string, string> = {
  '"': '"',
  "'": "'",
  '?': '?',
  '\\': '\\',
  E: '\u001B',
  a: '\u0007',
  b: '\b',
  e: '\u001B',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};
const escapeToken = /x[\da-fA-F]{1,2}|[0-7]{1,3}|u[\da-fA-F]{1,4}|U[\da-fA-F]{1,8}|c[\s\S]|[\s\S]/y;

function decodeBytes(bytes: number[]): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    throw webError("A $'...' byte escape is not valid UTF-8, so it cannot be shown as text.");
  }
}

function nonNul(code: number): number {
  if (code === 0) throw webError("A $'...' string with a NUL escape is unsupported.");

  return code;
}

function byteOf(token: string): number | undefined {
  if (/^x[\da-fA-F]/.test(token)) return nonNul(Number.parseInt(token.slice(1), 16));
  if (/^[0-7]/.test(token)) return nonNul(Number.parseInt(token, 8) % 256);

  return undefined;
}

function textOf(token: string): string {
  if (/^[uU][\da-fA-F]/.test(token)) {
    const code = nonNul(Number.parseInt(token.slice(1), 16));

    if (code > 0x10ffff) throw webError(`\\${token} is not a Unicode code point.`);

    return String.fromCodePoint(code);
  }

  if (token.length === 2 && token.startsWith('c'))
    return String.fromCharCode(nonNul((token.codePointAt(1) ?? 0) % 32));

  // Bash keeps the backslash of an escape it does not know.
  return namedEscapes[token] ?? `\\${token}`;
}

export function readAnsiCQuote(command: string, start: number): { end: number; text: string } {
  let text = '';
  let bytes: number[] = [];

  const append = (value: string): void => {
    text += decodeBytes(bytes) + value;
    bytes = [];
  };

  for (let index = start; index < command.length; index += 1) {
    const character = command[index]!;

    if (character === "'") {
      append('');

      return { end: index, text };
    }

    if (character !== '\\') {
      append(character);

      continue;
    }

    escapeToken.lastIndex = index + 1;

    const token = escapeToken.exec(command)?.[0];

    if (token === undefined) break;

    const byte = byteOf(token);

    if (byte === undefined) append(textOf(token));
    else bytes.push(byte);

    index += token.length;
  }

  throw webError('Command has an unterminated quote.');
}
