import { FunctionError } from '../errors';

export function textToAscii(text: string): string {
  return [...text]
    .map((character) => {
      const code = character.codePointAt(0);

      if (code === undefined || code > 127) {
        throw new FunctionError(
          'UNSUPPORTED_ASCII_CHARACTER',
          'ASCII encoding only supports characters from U+0000 to U+007F.',
        );
      }

      return String(code);
    })
    .join(' ');
}

export function asciiToText(text: string): string {
  const input = text.trim();

  if (!input) throw new FunctionError('REQUIRED_INPUT', 'ASCII input is required.');

  return input
    .split(/\s+/)
    .map((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        throw new FunctionError('INVALID_ASCII', 'ASCII input must be decimal character codes.');
      }

      const code = Number(part);

      if (code > 127) {
        throw new FunctionError('ASCII_OUT_OF_RANGE', 'ASCII codes must be between 0 and 127.');
      }

      return String.fromCharCode(code);
    })
    .join('');
}
