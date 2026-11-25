import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A Caesar cipher substitutes each letter with another a fixed number of positions along the alphabet, wrapping from Z back to A.\n\nROT13 uses a shift of 13 across the 26 ASCII letters, so applying it twice returns the original text; it is obfuscation, not secure encryption.',
      title: 'What is a Caesar cipher?',
    },
    {
      content: [
        'Decode or create ROT13 text for a puzzle, spoiler or teaching example.',
        'Demonstrate alphabet rotation with a positive or negative shift.',
        'Test a simple reversible letter substitution without changing digits, whitespace or punctuation.',
      ],
      title: 'When to use Caesar/ROT13 Cipher',
    },
  ],
  examples: [
    'Shift 13: Hello → Uryyb → Hello on a second run',
    'Shift 3: Abc xyz! → Def abc!',
    'Shift -3: Def abc! → Abc xyz!',
    'Shift 0 or 26: Hello → Hello',
    'Shift 29: Abc → Def (29 wraps to 3)',
  ],
  faq: [
    {
      answer:
        'Run the text with the opposite shift: a message made with shift 3 is restored with -3, or with 23, which is the same rotation. If the shift is unknown, try 1 to 25 until readable text appears.',
      question: 'How do I decode a Caesar cipher?',
    },
    {
      answer:
        'A shift of 13 is exactly half of the 26-letter alphabet, so two rotations add up to a full turn. Running Shift 13 on ROT13 text therefore restores it, while any other shift needs its negative to undo it.',
      question: 'Why does ROT13 use the same setting to encode and decode?',
    },
    {
      answer:
        'Yes. Any whole number in the JavaScript safe-integer range works and is reduced modulo 26, so 29 behaves like 3 and -1 like 25. Decimal values such as 2.5 and an empty Shift are rejected.',
      question: 'Can I use a negative shift or one larger than 25?',
    },
    {
      answer:
        'No. Only the ASCII letters A–Z and a–z rotate, so letters such as é, ß or Cyrillic characters stay as they are and words containing them are only partly shifted: café with shift 13 becomes pnsé.',
      question: 'Does it work with accented letters or other alphabets?',
    },
  ],
  help: 'Paste or type the text to rotate; digits, spaces, punctuation and accented letters are copied unchanged.\n\nEnter a whole-number Shift; the default 13 applies ROT13, and a positive value moves letters forward through the alphabet.\n\nTo undo a shift, run the result with its negative, such as -3 after 3; for ROT13, run the output with 13 again to restore the original text.\n\nRun and copy the result; use 0 to leave the text unchanged, and check the summary for the shift that was applied.',
  notes: [
    'Only A–Z and a–z rotate; case is preserved, while accents, emoji, punctuation, spaces and digits stay unchanged.',
    'Shifts wrap modulo 26; an empty Shift, fractions, exponent notation and integers outside the JavaScript safe range are rejected.',
    'There are only 26 distinct rotations, so this does not protect secrets or replace modern cryptography.',
  ],
};
