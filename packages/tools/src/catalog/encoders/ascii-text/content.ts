import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'ASCII assigns 128 code values to English letters, digits, punctuation and control characters; A is decimal 65 and a space is 32.\n\nASCII is not a general Unicode encoding, so accented letters and emoji cannot be represented by this converter.',
      title: 'What is ASCII?',
    },
    {
      content: [
        'Inspect decimal character codes for an ASCII-only protocol, fixture or teaching example.',
        'Turn whitespace-separated decimal ASCII values back into text.',
        'Compare decimal ASCII codes with their hexadecimal or binary byte representation.',
      ],
      title: 'When to use ASCII/Text Converter',
    },
  ],
  examples: [
    'Text to ASCII: ABC → 65 66 67',
    'ASCII to text: 72 105 → Hi',
    'Space and newline: 32 10 → a space followed by a line break',
    'Digits are characters too: 2026 → 50 48 50 54',
    'ASCII to text: 72 101 108 108 111 33 → Hello!',
  ],
  faq: [
    {
      answer:
        'Uppercase A is 65 and lowercase a is 97; the two cases of a letter always differ by exactly 32. The digit 0 is 48 and a space is 32. Text to ASCII lists the decimal code of every character you enter.',
      question: 'What is the ASCII code for A?',
    },
    {
      answer:
        'Digits are characters with their own codes: 0 is 48, so 5 is 53. Decoding the number 5 does not give the digit; it gives the invisible control character ENQ (U+0005).',
      question: 'Why does the digit 5 convert to 53?',
    },
    {
      answer:
        'ASCII defines only codes 0 to 127, and characters such as é, € or 🐎 have no ASCII code. So-called extended ASCII values from 128 to 255 differ between code pages, so the tool reports an error instead of guessing; use Hex or Unicode Escape for such text.',
      question: 'Why are accented letters and emoji rejected?',
    },
    {
      answer:
        'Yes. Each value may have one to three decimal digits, so 065 decodes to A just like 65. Values with four or more digits, such as 0065, and values above 127 are rejected.',
      question: 'Does ASCII to text accept leading zeros such as 065?',
    },
  ],
  help: 'Choose Text to ASCII for ASCII-only text, or ASCII to text for decimal character codes.\n\nFor Text to ASCII, paste the text; every character, including spaces and line breaks, becomes its decimal code, separated by single spaces.\n\nFor ASCII to text, separate decimal values with spaces, tabs or line breaks; each value must be an integer from 0 to 127.\n\nRun and copy the result, or use “Use result & reverse”; for non-ASCII text choose the Unicode, Hex or Binary converter instead.',
  notes: [
    'Only U+0000–U+007F is supported; extended 8-bit code pages, accented characters and emoji are rejected.',
    'Decode input uses decimal numbers, not hex, binary, commas or character names.',
    'Codes 0–31 and 127 are control characters; some decoded output may be invisible even though it is present in the copied text.',
  ],
};
