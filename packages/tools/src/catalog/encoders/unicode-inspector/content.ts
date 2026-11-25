import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Unicode assigns every character a code point, written U+ followed by hex digits. The inspector lists each code point of your text with its general category, its UTF-8 bytes and its UTF-16 code units.',
        'Everything runs locally in your browser or editor.',
      ],
      title: 'What the inspector shows',
    },
    {
      content: [
        'What a reader sees as one character is a grapheme, which can be several code points, for example a letter plus a combining accent or an emoji joined with zero-width joiners. The Grapheme column numbers these groups.',
        'Control and invisible characters have an empty Char column, and ASCII controls show their control picture such as the symbol for a line feed.',
      ],
      title: 'Graphemes and invisible characters',
    },
  ],
  examples: [
    '\u00E9 → U+00E9, UTF-8 C3 A9, UTF-16 00E9, Ll Lowercase Letter',
    '\u{1F600} → U+1F600, UTF-8 F0 9F 98 80, UTF-16 D83D DE00',
    'e + U+0301 → 2 code points, 1 grapheme',
    'A lone surrogate → Cs Surrogate, invalid UTF-8',
  ],
  faq: [
    {
      answer:
        'A grapheme is what a reader perceives as one character. It may be built from several code points, such as a base letter with combining marks or an emoji sequence.',
      question: 'What is the difference between a code point and a grapheme?',
    },
    {
      answer:
        'A lone surrogate is half of a UTF-16 pair without its partner. It has no valid UTF-8 form, so the row says invalid and the byte total skips it.',
      question: 'What is a lone surrogate?',
    },
    {
      answer:
        'Characters such as controls, format characters and spaces have no visible glyph, so the Char column stays empty. Use the code point and category to identify them.',
      question: 'Why is the Char column empty for some rows?',
    },
    {
      answer:
        'Switch the output to JSON to get the same rows as a JSON array with the fields category, char, codePoint, grapheme, index, utf16 and utf8.',
      question: 'Can I get the result as JSON?',
    },
  ],
  help: 'Paste or type text and the inspector lists every code point.\n\nThe table shows the position, grapheme number, character, code point, general category, UTF-8 bytes and UTF-16 code units.\n\nThe summary counts code points, graphemes and valid UTF-8 bytes.\n\nUse the JSON output when you want to copy the rows into another tool.',
  notes: [
    'Input is limited to 10,000 code points.',
    'Graphemes follow the Unicode segmentation rules of your browser or editor.',
    'Lone surrogates are reported as Cs Surrogate and add no UTF-8 bytes.',
    'Category names follow the Unicode general categories.',
  ],
};
