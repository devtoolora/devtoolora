import { FunctionError } from '../errors';

export function caesarCipher(text: string, shift: number): string {
  if (!Number.isSafeInteger(shift)) {
    throw new FunctionError('INVALID_SHIFT', 'Shift must be a safe integer, such as 13, 3 or -3.');
  }

  const normalizedShift = ((shift % 26) + 26) % 26;

  return text.replace(/[a-z]/gi, (character) => {
    const base = character >= 'a' && character <= 'z' ? 97 : 65;

    return String.fromCharCode(((character.charCodeAt(0) - base + normalizedShift) % 26) + base);
  });
}
