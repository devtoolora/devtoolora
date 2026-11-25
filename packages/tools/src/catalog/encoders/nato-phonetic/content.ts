import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The NATO phonetic alphabet gives every letter a distinct code word so that names and codes survive a noisy phone or radio line. A becomes Alfa, B becomes Bravo and so on up to Zulu.',
        'Everything runs locally in your browser or editor. Digits are spelled as Zero to Nine, a space becomes a slash, and each line of the input stays its own line.',
      ],
      title: 'What is the NATO phonetic alphabet?',
    },
    {
      content: [
        'Encoding strips accents first, so é is spelled as Echo. Characters that are not letters or digits, such as a hyphen, pass through as their own word.',
        'Decoding ignores case and accepts the spoken variants Alpha, Juliet, Xray, Nine and Niner. A slash becomes a space. A lone punctuation mark passes through, and any other unknown word is rejected with its position.',
      ],
      title: 'Encoding and decoding rules',
    },
  ],
  examples: [
    'SOS 2 → Sierra Oscar Sierra / Two',
    'Jx-é → Juliett X-ray - Echo',
    'Alfa Bravo → AB',
    'alpha JULIET xray niner / two → AJX9 2',
  ],
  faq: [
    {
      answer:
        'The code words are the official ICAO spellings: Alfa and Juliett with the extra letters. The decoder also accepts Alpha and Juliet, so either spelling works.',
      question: 'Why are Alfa and Juliett spelled that way?',
    },
    {
      answer:
        'Input is limited to 100,000 characters. A word the decoder does not know is rejected with its position, such as word 2 on line 3, so you can find the typo quickly.',
      question: 'What happens with an unknown word?',
    },
    {
      answer:
        'Windows line endings are treated like normal line breaks, and each line is spelled on its own. Line breaks come out as plain newlines.',
      question: 'How are line breaks handled?',
    },
    {
      answer:
        'Accents are removed before spelling, so a letter such as é becomes Echo. Letters that are not in A-Z after that, such as Chinese characters, pass through unchanged.',
      question: 'Does it handle accented letters?',
    },
  ],
  help: 'Choose Text to NATO or NATO to text and paste your input.\n\nWhen spelling, letters and digits become code words separated by spaces, and a space in your text becomes a slash.\n\nWhen decoding, put code words separated by spaces and use a slash for a space.\n\nThe summary shows the direction and the number of characters.',
  notes: [
    'Input is limited to 100,000 characters.',
    'A slash in the original text also decodes to a space, so a text with slashes does not round trip exactly.',
    'Accents are stripped before spelling.',
    'Tabs and letters without a NATO word, such as \u00DF or Chinese characters, pass through when spelling but are not restored when decoding.',
    'Code words are matched ignoring case.',
  ],
};
