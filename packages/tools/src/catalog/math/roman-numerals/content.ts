import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Roman numerals write numbers with the letters I (1), V (5), X (10), L (50), C (100), D (500) and M (1000). Letters add up, except that a smaller letter placed before a larger one is subtracted, so IV is 4 and CM is 900.\n\nThis converter accepts only the standard form: each number has exactly one spelling, so 4 is IV and never IIII, and 99 is XCIX and never IC.',
      title: 'What are Roman numerals?',
    },
    {
      content: [
        'Convert a year, chapter number or movie sequel number to Roman numerals, or read one back.',
        'Check a list of numerals from a document or inscription and spot the ones that are not standard.',
        'Convert many values at once by putting one per line.',
      ],
      title: 'When to use Roman Numeral Converter',
    },
  ],
  examples: [
    '2024 becomes MMXXIV.',
    'MCMXCIV (or mcmxciv) becomes 1994.',
    '3999 becomes MMMCMXCIX, the largest standard numeral.',
    'IIII is rejected with "standard form is IV".',
    'IC is rejected with "standard form is XCIX".',
    '0 and 4000 are rejected because Roman numerals cover 1-3,999.',
  ],
  faq: [
    {
      answer:
        'Standard form uses subtraction (IV, IX, XL, XC, CD, CM) and never repeats a letter more than three times. IIII is a common clock-face variant but is not accepted here.',
      question: 'Why is IIII rejected?',
    },
    {
      answer:
        'The standard system has no zero, and without an overline for thousands it cannot write 4,000 or more. The converter therefore stops at 3,999.',
      question: 'Why is 0 or 4000 an error?',
    },
    {
      answer:
        'Each line is converted on its own, and a line that fails shows an error message next to it while the other lines still convert. The summary counts converted and invalid lines.',
      question: 'What happens when one line is invalid?',
    },
    {
      answer:
        'A line made only of digits is converted to Roman, and a line made only of the letters I, V, X, L, C, D and M (in any case) is converted to a number. Anything else, such as -5, 1.5 or a word, is an error.',
      question: 'How does it tell numbers from numerals?',
    },
  ],
  help: 'Type or paste one value per line: a whole number from 1 to 3,999, or a Roman numeral such as XIV.\n\nEach output line reads input, an arrow, then the result. Blank lines stay blank.\n\nA line that cannot be converted shows an error message instead, such as IIII with its standard form IV.\n\nCopy or save the result as text.',
  notes: [
    'Input is limited to 10,000 lines of at most 64 characters each; lines are trimmed, and a longer line or more lines is an error.',
    'Values must be between 1 and 3,999.',
    'Only the standard subtractive form is accepted, so IIII, VX and IC are errors with the correct form shown.',
    'There is no zero, no fractions and no overline notation for thousands.',
    'A line of digits converts to Roman and a line of Roman letters converts to a number, in upper or lower case; signs and decimals such as -5 or 1.5 are errors.',
    'Blank lines are kept in the output and count as neither converted nor invalid.',
  ],
};
