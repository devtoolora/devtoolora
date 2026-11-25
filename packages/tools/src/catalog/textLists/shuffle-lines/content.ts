import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Shuffle & Pick Random Lines reorders the lines of a list into a random order, or draws a fixed number of random lines from it. It is the quick way to run a raffle, pick a winner, randomize a test order or sample rows from a file.',
        'The shuffle is a Fisher-Yates shuffle driven by the browser or editor crypto random source, with rejection sampling so every permutation is equally likely. Everything runs locally; nothing is uploaded.',
      ],
      title: 'What does this tool do?',
    },
    {
      content: [
        'Draw a winner or a few winners from a list of names.',
        'Randomize the order of quiz questions, speakers or test cases.',
        'Take a random sample of rows from a pasted list.',
        'Shuffle a playlist or a to-do list.',
      ],
      title: 'When to use Shuffle & Pick Random Lines',
    },
  ],
  examples: [
    'Shuffle all: Ada, Bob and Cleo on separate lines come back in a random order.',
    'Pick one winner: five names with Pick random and 1 line return a single name.',
    'Pick three: five colors with 3 lines return three different lines.',
    'Trailing newline: a list ending with a line break keeps one line break at the end.',
    'Mixed endings: CRLF, CR and LF are all treated as line breaks and the output uses LF.',
  ],
  faq: [
    {
      answer:
        'Randomness comes from crypto.getRandomValues, the same cryptographically secure source used for tokens. Rejection sampling removes modulo bias, so every line has the same chance in every position.',
      question: 'What kind of randomness is used?',
    },
    {
      answer:
        'A seed would make the order repeatable and therefore guessable, which defeats a fair draw. Every run uses fresh secure randomness, so the same input gives a different result each time.',
      question: 'Why is there no seed?',
    },
    {
      answer:
        'Blank lines are lines like any other and are shuffled or picked with the rest. Only the empty line after a final line break is ignored, and the break is restored at the end of the output.',
      question: 'What happens to empty lines?',
    },
  ],
  help: 'Paste one item per line or choose a sample, then pick a mode.\n\nShuffle all returns every line in a random order. Pick random returns the number of lines you set, chosen without repetition: the list is shuffled and the first lines are kept.\n\nThe number of lines to pick must be a whole number from 1 to the number of input lines. Line breaks of any kind (LF, CRLF, CR) split the input and the output uses LF.\n\nEach run produces a new result. Copy it, insert it into the editor, or save shuffled.txt or picked.txt.',
  notes: [
    'Input is limited to 100,000 UTF-16 units and 10,000 lines.',
    'Randomness is cryptographic and cannot be seeded, so results are not reproducible.',
    'Pick random never repeats a line position; duplicate lines in the input can still appear more than once in the output.',
    'Output always uses LF line endings. A final line break in the input is kept once at the end of the output.',
  ],
};
