import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Hexadecimal notation uses the digits 0–9 and A–F; two hex digits represent one byte, so the UTF-8 byte for A is 41.\n\nThis tool converts UTF-8 bytes rather than Unicode code point numbers; č is c4 8d even though its code point is U+010D.',
      title: 'What is hexadecimal text encoding?',
    },
    {
      content: [
        'Inspect the byte representation of a text payload or compare it with a UTF-8 hex dump.',
        'Recover text from complete hexadecimal byte pairs copied from a log or test fixture.',
        'Check multibyte characters using the Binary and Unicode Escape tools alongside this converter.',
      ],
      title: 'When to use Hex/Text Converter',
    },
  ],
  examples: [
    'Text to hex: Hi → 48 69',
    'Hex to text: 4869 or 48 69 → Hi',
    'UTF-8 bytes: č → c4 8d',
    'Emoji: 😀 → f0 9f 98 80',
    'Hex to text: 4F 4B 21 → OK!',
  ],
  faq: [
    {
      answer:
        'Choose Hex to text and paste the bytes, such as 48 65 6c 6c 6f or 48656c6c6f. Every two hex digits form one byte, and the bytes are decoded as UTF-8, giving Hello.',
      question: 'How do I convert hex to text?',
    },
    {
      answer:
        'No. The input may contain only hex digits and whitespace, so strip prefixes and separators first: 0x48, 0x69 becomes 48 69. An odd number of digits is also an error.',
      question: 'Can I paste hex with 0x prefixes or commas?',
    },
    {
      answer:
        'The tool shows UTF-8 bytes, and UTF-8 stores é as the two bytes c3 a9. E9 is its Unicode code point and its Latin-1 byte; decoding a lone e9 fails because it is not valid UTF-8.',
      question: 'Why does é become c3 a9 and not e9?',
    },
    {
      answer:
        'No. Converting between text and hex is a local byte calculation, and the tool makes no network request.',
      question: 'Does this tool send my text anywhere?',
    },
  ],
  help: 'Choose Text to hex to encode plain text, or Hex to text to decode UTF-8 bytes.\n\nFor Text to hex, paste the text; each UTF-8 byte becomes two lowercase hex digits, and the pairs are separated by spaces.\n\nFor Hex to text, paste complete hex byte pairs, either together or separated by whitespace; uppercase and lowercase hex digits are accepted.\n\nRun and copy the result, or use “Use result & reverse” to check the round trip.',
  notes: [
    'Input must have an even number of hex digits after removing whitespace; 0x prefixes, commas, offsets and ASCII dump columns are not supported.',
    'Valid hexadecimal bytes must also form valid UTF-8; ff is a byte but cannot be decoded as UTF-8 text.',
    'This is a text converter rather than a file decoder; valid spaces, line breaks and a leading U+FEFF character are preserved.',
  ],
};
