import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'FIGlet turns ordinary characters into larger letters composed of text glyphs. Spaces and line breaks are part of the drawing, so the result must be viewed in a monospace font without soft wrapping.',
        'This is a text-banner generator, not an image-to-ASCII converter. Some bundled fonts use Unicode blocks or decorative characters, so not every output is strictly 7-bit ASCII.',
      ],
      title: 'What is a FIGlet text banner?',
    },
    {
      content: [
        'Create terminal headings, README banners and plain-text signatures.',
        'Compare different letter shapes and spacing before copying a banner.',
        'Insert a small text heading into an editor without generating an image.',
        'Use short labels; use semantic headings instead for accessible web navigation and important information.',
      ],
      title: 'When to use ASCII Text Generator',
    },
  ],
  examples: [
    'Hi + Standard → a 6-row banner whose first row is "  _   _ _ ".',
    'Hi + Small → a 5-row banner; a different font changes letter shapes, not image size.',
    'Hi + Standard → 10 columns with Font default, 11 with Fitted and 12 with Full spacing.',
    'Hi followed by Bye on a new line → two stacked banners; vertical spacing controls their packing.',
    'Příliš + Big + Strip accents → the banner for Prilis; with Exact text, Big reports ř (U+0159) and š (U+0161) as unsupported.',
    'Łódź + Big + Strip accents → the banner for Lodz; Ł has no combining mark, so it is folded to L explicitly.',
    'DEV + ANSI Shadow → letters drawn with Unicode block characters such as █ and ╗, not 7-bit ASCII.',
  ],
  faq: [
    {
      answer:
        'Each FIGlet font contains drawings for a limited set of characters, and coverage differs between fonts: Standard can draw č, but Big cannot. The error names the character and its code point instead of silently dropping it; choose another font or Strip accents, which turns č into c and Ł into L.',
      question: 'Why does a font say it cannot render a character?',
    },
    {
      answer:
        'No. Emoji and other characters above U+FFFF are always rejected because the bundled FIGlet renderer indexes UTF-16 code units. Other characters work only when the selected font has a visible glyph for them.',
      question: 'Can I use emoji in a banner?',
    },
    {
      answer:
        'FIGlet output only lines up in a monospace font with line wrapping turned off. Paste it into a code block, terminal or editor that uses a fixed-width font, and keep the trailing spaces.',
      question: 'Why does my banner look broken after pasting it?',
    },
    {
      answer:
        'Not always. Classic fonts such as Standard and Big draw with ASCII symbols, but fonts such as ANSI Shadow use Unicode box and block characters like █ and ╗, which need UTF-8 and a font that contains them.',
      question: 'Is the output always plain ASCII?',
    },
    {
      answer:
        'There are 311 bundled FIGlet fonts, searchable by name in the Font field. Font names are matched without regard to letter case, and only the font you select is loaded.',
      question: 'How many fonts can I choose from?',
    },
  ],
  help: 'Type a short label or apply a sample. Use newlines to stack labels.\n\nSearch Font by name. The selected bundled font is loaded locally and the banner updates automatically.\n\nCompare horizontal and vertical spacing. Start with Font default; choose Full spacing for separated glyphs or rows.\n\nIf a character is unsupported, the error identifies it and its Unicode code point. Choose another font or explicitly enable Strip accents.\n\nThe preview keeps every space and does not wrap a wide banner. Use its horizontal scrollbar; copying or saving always includes the complete output.\n\nSave ascii-art.txt or copy/insert the banner. Use a monospace destination with wrapping disabled. No statistics footer or extra newline is added.',
  notes: [
    'Supports up to 100 input Unicode code points, including spaces and original line-break characters. CRLF counts as two input code points and is normalized to LF for rendering; CR also becomes LF.',
    'Tabs, control characters and unpaired surrogates are rejected. Input text is not automatically trimmed, uppercased or transliterated.',
    'A glyph must exist and have a visible drawing in the selected font. Supplementary Unicode characters, including emoji, are rejected because the bundled FIGlet renderer indexes UTF-16 code units.',
    'Strip accents removes decomposed combining marks and folds the stroke letters Đ, Ħ, Ł, Ø and Ŧ, in either case, to D, H, L, O and T. It can change meaning and does not map ß, æ, other Latin letters or other writing systems to ASCII.',
    'Font default uses the font designer’s fitting rules and may smush glyphs. Fitted and Full spacing override packing; vertical changes matter only for multiple input lines.',
    'Output is limited to 100,000 UTF-16 units. An oversized result is an error, never a truncated banner.',
    'Summary dimensions count text rows and maximum code points per row, including padding. They are not pixel dimensions or a guarantee of terminal display-cell width for Unicode fonts.',
    'TXT export preserves exact spaces, glyphs and line breaks produced by FIGlet, with no added newline or metadata footer. Decorative Unicode fonts require a compatible destination font and UTF-8.',
    'Fonts remain lazy-loaded modules. Offline use depends on the selected font being available in the app or its offline cache.',
  ],
};
