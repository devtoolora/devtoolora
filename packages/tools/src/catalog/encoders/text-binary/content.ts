import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Binary notation writes a byte using eight bits, each either 0 or 1; for example, the letter A is the UTF-8 byte 01000001.\n\nThis converter shows UTF-8 bytes, not one binary number per character; č needs two bytes and many emoji need four.',
      title: 'What is binary text encoding?',
    },
    {
      content: [
        'Inspect the UTF-8 bytes behind a short text value or compare them with a hexadecimal dump.',
        'Learn how ASCII letters, accented characters and emoji occupy different numbers of bytes.',
        'Recover text from whitespace-separated 8-bit groups known to contain UTF-8.',
      ],
      title: 'When to use Text ↔ Binary',
    },
  ],
  examples: [
    'Text to binary: A → 01000001',
    'Binary to text: 01001000 01101001 → Hi',
    'UTF-8 bytes: č → 11000100 10001101',
    'Emoji: 🐎 → 11110000 10011111 10010000 10001110 (four bytes)',
  ],
  faq: [
    {
      answer:
        'Choose Text to binary and enter the text. Each character is encoded as UTF-8 and every byte is written as eight 0/1 digits, so A becomes 01000001 and Hi becomes 01001000 01101001.',
      question: 'How do I convert text to binary?',
    },
    {
      answer:
        'No. Binary to text needs whitespace between the 8-bit groups, so 0100100001101001 is rejected; split it every eight digits into 01001000 01101001 first.',
      question: 'Can I paste binary without spaces between bytes?',
    },
    {
      answer:
        'UTF-8 uses one byte for ASCII but two to four bytes for other characters: é is 11000011 10101001 and 🐎 takes four groups. The tool shows these bytes, not the code point number, so é is not 11101001.',
      question: 'Why do some characters produce more than one byte?',
    },
    {
      answer:
        'Not every byte sequence is UTF-8 text. 11111111 never occurs in UTF-8, and 11000100 alone is only the first half of a two-byte character, so both are reported as errors.',
      question: 'Why does decoding say the bytes are not valid UTF-8?',
    },
  ],
  help: 'Choose Text to binary to encode plain text, or Binary to text to decode UTF-8 bytes.\n\nFor Text to binary, paste the text; each UTF-8 byte becomes one 8-bit group, and the groups are separated by spaces.\n\nFor Binary to text, separate complete 8-bit groups with spaces, tabs or line breaks, such as 01001000 01101001.\n\nRun the conversion and copy the result, or use “Use result & reverse” to verify a round trip.',
  notes: [
    'Every group must contain exactly eight binary digits; continuous bit strings, 0b prefixes and comma-separated bytes are not accepted.',
    'Decoding rejects invalid UTF-8 instead of inserting replacement characters; arbitrary files and non-UTF-8 encodings are not supported.',
    'Valid text preserves spaces, line breaks and a leading U+FEFF character through a round trip.',
  ],
};
