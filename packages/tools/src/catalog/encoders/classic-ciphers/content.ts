import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Classic ciphers are hand-made substitution and transposition schemes from before computers. They are fun and useful for puzzles, teaching and obfuscation, but they offer no real security.',
        'Everything runs locally in your browser or editor. Only the letters A-Z are changed by Vigenère, Atbash and Affine; digits, punctuation, spaces and accented letters pass through as they are.',
      ],
      title: 'What are classic ciphers?',
    },
    {
      content: [
        'Vigenère shifts each letter by the matching letter of a repeating key, so LEMON turns ATTACKATDAWN into LXFOPVEFRNHR. Atbash mirrors the alphabet (A becomes Z). Affine maps each letter x to a*x + b modulo 26, and a must be coprime with 26.',
        'Rail fence writes the text in a zigzag over several rails and reads it rail by rail. ROT47 rotates the 94 printable ASCII characters by 47, so applying it twice returns the original.',
      ],
      title: 'How each cipher works',
    },
  ],
  examples: [
    'Vigenère, key LEMON: ATTACKATDAWN \u2192 LXFOPVEFRNHR',
    'Atbash: Hello \u2192 Svool',
    'Affine a=5, b=8: AFFINE CIPHER \u2192 IHHWVC SWFRCP',
    'Rail fence, 3 rails: WEAREDISCOVEREDFLEEATONCE \u2192 WECRLTEERDSOEEFEAOCAIVDEN',
    'ROT47: Hello, World! \u2192 w6==@[ (@C=5P',
  ],
  faq: [
    {
      answer:
        'The Vigenère key is 1 to 256 letters A-Z. Case does not matter. Digits and other characters are rejected and the message names the position of the first one.',
      question: 'What can the Vigenère key contain?',
    },
    {
      answer:
        'Affine decoding needs a modular inverse of a, which exists only when a shares no factor with 26. Use one of 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23 or 25.',
      question: 'Why is a=13 rejected for Affine?',
    },
    {
      answer:
        'Atbash and ROT47 are their own inverse, so running them again restores the text. The Mode switch is hidden for these two ciphers.',
      question: 'Why is there no Decode for Atbash and ROT47?',
    },
    {
      answer:
        'Rail fence works on whole characters, so emoji and accented letters stay intact and decode back exactly. Use 2 to 100 rails.',
      question: 'Does rail fence handle emoji and accents?',
    },
  ],
  help: 'Pick a cipher, set its options and paste your text.\n\nVigenère needs a key of letters. Affine needs the numbers a and b, where a must be coprime with 26. Rail fence needs a number of rails from 2 to 100.\n\nChoose Encode or Decode for the ciphers that are not their own inverse.\n\nThe summary shows the direction and the cipher name.',
  notes: [
    'Input is limited to 1,000,000 characters.',
    'Classic ciphers are not secure encryption; never use them to protect real secrets.',
    'Letters outside A-Z, such as accented letters, are left unchanged by the letter ciphers.',
    'Vigenère advances the key only on letters, so spaces and punctuation do not consume it.',
  ],
};
