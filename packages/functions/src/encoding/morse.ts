import { FunctionError } from '../errors';

const MORSE_BY_CHAR: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
};
const CHAR_BY_MORSE = new Map(
  Object.entries(MORSE_BY_CHAR).map(([character, morse]) => [morse, character]),
);

export function textToMorse(text: string): string {
  const input = text.trim();

  if (!input) throw new FunctionError('REQUIRED_INPUT', 'Text input is required.');

  return input
    .split(/\s+/)
    .map((word) =>
      [...word]
        .map((character) => {
          const morse = MORSE_BY_CHAR[character.toUpperCase()];

          if (character.charCodeAt(0) > 127 || !morse)
            throw new FunctionError(
              'UNSUPPORTED_MORSE_CHARACTER',
              `Cannot encode character as Morse: ${character}`,
            );

          return morse;
        })
        .join(' '),
    )
    .join(' / ');
}

export function morseToText(text: string): string {
  const input = text.trim();

  if (!input) throw new FunctionError('REQUIRED_INPUT', 'Morse input is required.');

  return input
    .split('/')
    .map((word) => word.trim())
    .map((word) => {
      if (!word)
        throw new FunctionError(
          'UNKNOWN_MORSE_SEQUENCE',
          'Morse input has an empty word: remove the extra / separator.',
        );

      return word
        .split(/\s+/)
        .map((part) => {
          const character = CHAR_BY_MORSE.get(part);

          if (!character)
            throw new FunctionError('UNKNOWN_MORSE_SEQUENCE', `Unknown Morse sequence: ${part}`);

          return character;
        })
        .join('');
    })
    .join(' ');
}
