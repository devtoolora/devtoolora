import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Base-N encodings write arbitrary bytes using a limited alphabet so they survive text-only channels. Base64 is the best known; this tool covers its less common relatives: Base32, Base32hex, Base58, Base45 and Ascii85.',
        'Text is converted to UTF-8 bytes first, and decoding turns the bytes back into UTF-8 text. Everything runs locally in your browser or editor.',
      ],
      title: 'What are Base32, Base58, Base45 and Ascii85?',
    },
    {
      content: [
        'Base32 (RFC 4648) uses A-Z and 2-7 with = padding; it is case-insensitive, which suits TOTP secrets and file names.',
        'Base32hex keeps the same layout with the alphabet 0-9 and A-V so encoded values sort like the bytes they hold.',
        'Base58 (Bitcoin alphabet) drops 0, O, I and l to avoid look-alike characters; it is used for addresses and short ids.',
        'Base45 (RFC 9285) is designed for QR codes in alphanumeric mode, as in EU digital COVID certificates.',
        'Ascii85 packs four bytes into five characters, so it is about 25 percent larger than the input instead of 33 percent.',
      ],
      title: 'When to use each base',
    },
  ],
  examples: [
    'Base32: foobar → MZXW6YTBOI======',
    'Base32hex: foobar → CPNMUOJ1E8======',
    'Base58: Hello World! → 2NEpo7TZRRrLZSi2U',
    'Base45: Hello!! → %69 VD92EX0',
    'Ascii85: Hello, World → 87cURD_*#4DfTZ)',
  ],
  faq: [
    {
      answer:
        'Choose Base32 when the value is typed or read aloud, or must survive case-insensitive systems such as file names and DNS labels. Base64 is shorter, but it mixes letter case and uses + and /.',
      question: 'When should I use Base32 instead of Base64?',
    },
    {
      answer:
        'Base58 removes 0 (zero), O (capital o), I (capital i) and l (lowercase L) because they are easy to confuse when copied by hand. It also omits + and /, so the value is safe to double-click and select.',
      question: 'Why does Base58 not use 0, O, I and l?',
    },
    {
      answer:
        'Base45 is built for QR codes. Its 45 characters are exactly the QR alphanumeric set, so the encoded text uses the compact alphanumeric mode instead of the larger byte mode.',
      question: 'What is Base45 used for?',
    },
    {
      answer:
        'In Ascii85 the single letter z stands for four zero bytes, which would otherwise be written !!!!!. It is only valid at a group boundary and is never used inside a group or for a partial group.',
      question: 'What does z mean in Ascii85?',
    },
    {
      answer:
        'The decoded bytes are not a valid UTF-8 text, for example a hash or an image. This tool only returns text and never guesses an encoding, so it reports the problem instead of showing garbled characters.',
      question: 'Why does decode say the bytes are not valid UTF-8?',
    },
  ],
  help: 'Pick a base, choose Encode or Decode, then paste your text.\n\nEncode converts the text to UTF-8 bytes and writes them in the selected alphabet. Base32 output is padded with = characters.\n\nDecode accepts Base32 in lower or upper case with or without padding, and ignores whitespace in Base32, Base58 and Ascii85. Ascii85 input may be wrapped in <~ and ~>, and may use z for four zero bytes.\n\nAny other invalid character is reported with its 1-based position, and bytes that are not valid UTF-8 text are reported as an error instead of being shown as garbled characters.',
  notes: [
    'Text is encoded as UTF-8. Decoding fails with "Decoded bytes are not valid UTF-8 text." when the bytes are not text.',
    'Input is limited to 1,000,000 bytes or UTF-16 units. Base58 is limited to 10,000 bytes (14,000 characters when decoding) because its conversion is quadratic.',
    'Base32 and Base32hex are padded with = on encode; decode accepts missing padding and lower case.',
    'Base32 decoding is lenient: it does not check the padding count and ignores non-zero trailing bits, so two different texts can decode to the same bytes.',
    'Base45 is case-sensitive and the space character is part of its alphabet, so spaces are never ignored. A trailing line break is ignored when decoding.',
    'Ascii85 uses the Adobe variant without the <~ ~> wrappers on encode; decode accepts the wrappers and ignores whitespace.',
  ],
};
