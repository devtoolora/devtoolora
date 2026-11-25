import { FunctionError } from '../errors/FunctionError';

export type QpCharset = 'iso-8859-1' | 'iso-8859-2' | 'utf-8' | 'windows-1250' | 'windows-1252';

const maxChars = 1_000_000;
const maxLineLength = 75;
const hex = '0123456789ABCDEF';
const encodedWord = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;

function assertSize(text: string): void {
  if (text.length > maxChars)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');
}

function invalidSequence(position: number): FunctionError {
  return new FunctionError(
    'INVALID_INPUT',
    `Invalid quoted-printable sequence at position ${position}.`,
  );
}

function hexValue(text: string, index: number): number {
  const pair = text.slice(index, index + 2);

  return /^[0-9A-Fa-f]{2}$/.test(pair) ? parseInt(pair, 16) : -1;
}

function lineBreakLength(text: string, index: number): number {
  if (text[index] === '\r') return text[index + 1] === '\n' ? 2 : 1;

  return text[index] === '\n' ? 1 : 0;
}

function isBlank(character: string | undefined): boolean {
  return character === ' ' || character === '\t';
}

function encodeLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  const lines: string[] = [];
  let current = '';

  bytes.forEach((byte, index) => {
    const literal =
      (byte >= 33 && byte <= 126 && byte !== 61) ||
      ((byte === 32 || byte === 9) && index < bytes.length - 1);
    const token = literal
      ? String.fromCharCode(byte)
      : `=${hex[byte >> 4] ?? ''}${hex[byte & 15] ?? ''}`;

    if (current.length + token.length > maxLineLength) {
      lines.push(`${current}=`);
      current = '';
    }

    current += token;
  });

  lines.push(current);

  return lines.join('\n');
}

export function encodeQuotedPrintable(text: string): string {
  assertSize(text);

  return text.replace(/\r\n?/g, '\n').split('\n').map(encodeLine).join('\n');
}

function qpBytes(text: string, offset: number, underscoreIsSpace: boolean): number[] {
  const bytes: number[] = [];
  let index = 0;

  while (index < text.length) {
    const character = text.charAt(index);
    const breakLength = lineBreakLength(text, index);

    if (character === '=') {
      let after = index + 1;

      while (isBlank(text[after])) after += 1;
      const softBreak = lineBreakLength(text, after);

      if (softBreak > 0) {
        index = after + softBreak;

        continue;
      }

      const value = hexValue(text, index + 1);

      if (value < 0) throw invalidSequence(offset + index + 1);

      bytes.push(value);
      index += 3;
    } else if (breakLength > 0 || isBlank(character)) {
      let after = index;

      while (isBlank(text[after])) after += 1;
      const trailing = after === text.length || lineBreakLength(text, after) > 0;

      if (trailing && after > index) {
        index = after;
      } else if (breakLength > 0) {
        bytes.push(10);
        index += breakLength;
      } else {
        for (; index < after; index += 1) bytes.push(text.charCodeAt(index));
      }
    } else if (character.charCodeAt(0) > 126 || character.charCodeAt(0) < 32) {
      throw new FunctionError(
        'INVALID_INPUT',
        `Unexpected character at position ${offset + index + 1}. Encode it as =XX.`,
      );
    } else {
      bytes.push(underscoreIsSpace && character === '_' ? 32 : character.charCodeAt(0));
      index += 1;
    }
  }

  return bytes;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset, { fatal: true }).decode(bytes);
  } catch {
    throw new FunctionError('INVALID_INPUT', `The decoded bytes are not valid ${charset} text.`);
  }
}

export function decodeQuotedPrintable(text: string, charset: QpCharset): string {
  assertSize(text);

  return decodeBytes(Uint8Array.from(qpBytes(text, 0, false)), charset);
}

function base64Bytes(payload: string, position: number): number[] {
  try {
    return Array.from(atob(payload), (character) => character.charCodeAt(0));
  } catch {
    throw invalidBase64(position);
  }
}

function invalidBase64(position: number): FunctionError {
  return new FunctionError('INVALID_INPUT', `Invalid base64 payload at position ${position}.`);
}

function wordBytes(match: RegExpExecArray): number[] {
  const payload = match[3] ?? '';
  const position = match.index + 1;

  return (match[2] ?? '').toLowerCase() === 'b'
    ? base64Bytes(payload, position)
    : qpBytes(payload, match.index + (match[1] ?? '').length + 5, true);
}

function wordCharset(match: RegExpExecArray): string {
  const full = match[1] ?? '';
  const label = full.split('*')[0] || full;

  try {
    new TextDecoder(label);
  } catch {
    throw new FunctionError('INVALID_INPUT', `Unknown charset ${label}.`);
  }

  return label;
}

export function decodeMimeHeader(text: string): string {
  assertSize(text);

  let result = '';
  let lastEnd = 0;
  let pending: { bytes: number[]; charset: string } | undefined;
  let afterWord = false;

  const flush = (): void => {
    if (pending) result += decodeBytes(Uint8Array.from(pending.bytes), pending.charset);

    pending = undefined;
  };

  for (const match of text.matchAll(encodedWord)) {
    const gap = text.slice(lastEnd, match.index);
    const charset = wordCharset(match);

    if (!(afterWord && /^\s*$/.test(gap))) {
      flush();
      result += gap;
    }

    if (pending && pending.charset !== charset) flush();

    pending = pending ?? { bytes: [], charset };
    for (const byte of wordBytes(match)) pending.bytes.push(byte);
    lastEnd = match.index + match[0].length;
    afterWord = true;
  }

  flush();

  return result + text.slice(lastEnd);
}
