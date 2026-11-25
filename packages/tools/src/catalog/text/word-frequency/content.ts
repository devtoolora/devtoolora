import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The counter splits your text into words or characters and lists the most frequent ones with their counts and share of the total. It runs locally in your browser or editor.',
        'A word is a run of letters or digits, and an apostrophe inside a word such as don’t stays part of it. Letters from any script count, so accented and non-Latin words work.',
      ],
      title: 'What does the word frequency counter do?',
    },
    {
      content: [
        'Characters are counted by visible character (grapheme), so an emoji or a family sequence counts once. Whitespace is never counted.',
        'Ties keep the order of first appearance. The percentage is rounded to one decimal and is the share of all counted entries after filters.',
      ],
      title: 'Counting rules',
    },
  ],
  examples: [
    'The cat and the hat. THE end → the 3 (42.9%)',
    'Same text with stop words ignored → cat, hat, end',
    'hello world in characters → l 3, o 2',
    'Apple apple, case sensitive → Apple 1, apple 1',
  ],
  faq: [
    {
      answer:
        'Words are lowercased unless you tick Distinguish letter case. Characters are lowercased the same way. Turning the option on counts Apple and apple separately.',
      question: 'Is counting case sensitive?',
    },
    {
      answer:
        'It removes common English words such as the, and, of and is before counting. Words in other languages are not filtered, and the total shrinks accordingly.',
      question: 'What are stop words?',
    },
    {
      answer:
        'Input is limited to 1,000,000 characters and the top list to 1 to 1,000 entries. Longer text is rejected with a message that names the limit.',
      question: 'Are there size limits?',
    },
    {
      answer:
        'Yes. Characters are counted by grapheme, so an emoji, a flag or a joined family counts as one entry instead of several broken pieces.',
      question: 'Does it handle emoji?',
    },
  ],
  help: 'Paste your text and choose whether to count words or characters.\n\nFor words you can ignore English stop words and skip words shorter than a minimum length.\n\nTop entries sets how many rows are listed, from 1 to 1,000.\n\nThe table shows rank, value, count and percent, and the text output is value and count separated by a tab.',
  notes: [
    'Input is limited to 1,000,000 characters.',
    'Stop-word filtering is English only.',
    'Percent is the share of counted entries, after filters, rounded to one decimal.',
  ],
};
