import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The number to words tool spells numbers out in English, one number per line. It runs locally in your browser or editor, and large values keep every digit because no floating point is involved.',
        'Use it for cheques, contracts, invoices and spoken scripts where a figure must also be written as words.',
      ],
      title: 'What does number to words do?',
    },
    {
      content: [
        'Cardinal gives plain counting words, and decimals are read digit by digit after the word point. Ordinal gives first, second, twenty-first and so on, and needs a whole number.',
        'Cheque style writes the whole part in words and the cents as a fraction, like one thousand two hundred thirty-four and 50/100. It accepts at most two decimal places.',
      ],
      title: 'Styles and limits',
    },
  ],
  examples: [
    '1234567 → one million two hundred thirty-four thousand five hundred sixty-seven',
    '-12.05 → minus twelve point zero five',
    '21 as ordinal → twenty-first',
    '1234.5 as cheque → one thousand two hundred thirty-four and 50/100',
  ],
  faq: [
    {
      answer:
        'The whole part may have up to 36 digits, which reaches the decillions. The decimal part may have up to 20 digits. Longer numbers are rejected with a message.',
      question: 'How large can a number be?',
    },
    {
      answer:
        'Yes, when one kind of comma, underscore or space splits the whole part into groups of three digits, so 1,000,000 and 1 000 000 both read as one million. Anything else, such as 3,14 or 1234,50, is rejected instead of being read as a different number. Write decimals with a period.',
      question: 'Can I use thousands separators?',
    },
    {
      answer:
        'Each non-blank line is converted on its own and blank lines stay blank. If a line is not a number, the error names its 1-based line number.',
      question: 'How are several lines handled?',
    },
    {
      answer:
        'The output uses American style words without the word and inside the hundreds, so 101 is one hundred one. Ordinals follow the same pattern, giving one hundred first.',
      question: 'Which English style is used?',
    },
  ],
  help: 'Paste one number per line and pick a style.\n\nCardinal spells the number and reads decimals digit by digit.\n\nOrdinal gives first, second, third and needs whole numbers.\n\nCheque writes the whole part in words and the cents as a fraction over 100.\n\nThe summary shows how many numbers were converted and, when a line has a thousands separator, the value it read.',
  notes: [
    'Input is limited to 1,000 lines, 36 integer digits and 20 decimal digits.',
    'Cheque style allows at most two decimal places and does not round.',
    'Words are American English and omit the word and inside numbers.',
    'A comma never marks decimals, so 1,500 reads as one thousand five hundred. When a line has a separator, the summary states the value it read, such as Read as 1500.',
  ],
};
