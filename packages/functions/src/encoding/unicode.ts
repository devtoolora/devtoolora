import { FunctionError } from '../errors';

export function encodeUnicodeEscapes(text: string): string {
  return [...text].map((character) => `\\u{${character.codePointAt(0)?.toString(16)}}`).join('');
}

export function decodeUnicodeEscapes(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, braced, fixed) => {
    const codePoint = Number.parseInt(braced || fixed, 16);

    if (codePoint > 0x10ffff)
      throw new FunctionError(
        'INVALID_CODE_POINT',
        'Unicode code point is outside the valid range.',
      );

    return String.fromCodePoint(codePoint);
  });
}
