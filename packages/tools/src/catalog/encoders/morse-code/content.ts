import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Morse code represents characters using sequences of short and long signals, written here as dots and dashes; SOS is written as “... --- ...”.\n\nIn this text notation, spaces separate characters and a slash separates words; it is not an audio or timing representation.',
      title: 'What is Morse code?',
    },
    {
      content: [
        'Translate a short message or inspect a written Morse sequence.',
        'Practice letter and number mappings using a readable dot/dash representation.',
        'Create a puzzle or test fixture where uppercase output and normalized word spacing are acceptable.',
      ],
      title: 'When to use Morse Code Translator',
    },
  ],
  examples: [
    'Text to Morse: SOS → ... --- ...',
    'Morse to text: .... .. / - .... . .-. . → HI THERE',
    'Text to Morse: A1 → .- .----',
    'Text to Morse: OK? → --- -.- ..--..',
  ],
  faq: [
    {
      answer:
        'SOS is ... --- ...: three dots, three dashes, three dots. Radio operators send it as one continuous signal without letter gaps; this text notation writes it as the three letters S, O and S.',
      question: 'What is SOS in Morse code?',
    },
    {
      answer:
        'Use a slash between words and spaces between letters: .... .. / - .... . .-. . decodes to HI THERE. When encoding, any run of spaces, tabs or line breaks between words becomes a single " / ".',
      question: 'How do I separate words in Morse code?',
    },
    {
      answer:
        'Morse sequences are ambiguous without gaps: .- could be A or the letters E and T. The decoder therefore needs whitespace between characters, and ...---... is read as one unknown sequence rather than SOS.',
      question: 'Why does decoding fail when letters are written together?',
    },
    {
      answer:
        'No. Only A–Z, 0–9 and a set of ASCII punctuation marks have Morse codes here, so é, ñ, ü and emoji cause an error. Replace accented letters with plain ones, such as e, n or u, before encoding.',
      question: 'Can I translate accented letters such as é or ñ?',
    },
  ],
  help: 'Choose Text to Morse to encode supported text, or Morse to text to decode dot/dash notation.\n\nFor Text to Morse, enter letters, digits or supported punctuation; spaces, tabs or line breaks between words become a single /.\n\nFor Morse to text, separate each character with whitespace and each word with /, such as “.... .. / - .... . .-. .”.\n\nRun and copy the result, or use “Use result & reverse”; decoding produces uppercase letters, not the original capitalization.',
  notes: [
    'Supported input is A–Z, 0–9 and these punctuation marks: . , ? \' ! / ( ) & : ; = + - _ " $ @; accents, emoji and other characters are errors.',
    'Encoding trims outer whitespace and normalizes case and word spacing; a round trip is not lossless for capitalization, tabs or line breaks.',
    'Use literal . and - symbols rather than bullets or typographic dashes; unknown sequences are errors, and procedural signals and audio are not supported.',
  ],
};
