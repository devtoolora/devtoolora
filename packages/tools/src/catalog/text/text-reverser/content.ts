import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Text reversal changes the order of selected units. Reversing letters, word blocks and entire lines produces different results.',
        'The default uses Unicode grapheme clusters: a letter with its combining marks or a supported emoji sequence stays together. It changes text order, not the direction of the writing system, and it is not encryption or a visual mirror effect.',
      ],
      title: 'What is text reversal?',
    },
    {
      content: [
        'Create reversed headings or simple text puzzles without splitting common emoji sequences.',
        'Reverse whitespace-delimited word blocks while preserving the original separator slots.',
        'Reverse the order of a list or log’s physical lines.',
        'Inspect Unicode code-point ordering deliberately, or reverse characters within each line without moving line breaks.',
      ],
      title: 'When to use Text Reverser',
    },
  ],
  examples: [
    'Characters: abc → cba.',
    'Graphemes: Café 👩🏽‍💻 → 👩🏽‍💻 éfaC; the accent and emoji sequence stay with their base.',
    'Words with separator slots kept: "  one   two\tthree " → "  three   two\tone ".',
    'Each line: "abc\r\ndef\n" → "cba\r\nfed\n".',
    'Lines: "one\r\ntwo\rthree\n" → "three\r\ntwo\rone\n"; terminators stay in their original separator slots.',
  ],
  faq: [
    {
      answer:
        'The default unit is the grapheme cluster, so 🇨🇿👍🏽 → 👍🏽🇨🇿. Switch Character unit to Unicode code points to see the raw order instead, 🏽👍🇿🇨, which breaks the flag and skin tone apart.',
      question: 'Why do emoji and accented letters stay intact when reversed?',
    },
    {
      answer:
        'Choose Reverse: Lines. one / two / three → three / two / one, and each line ending stays in its original position.',
      question: 'How do I reverse the order of lines?',
    },
    {
      answer:
        'Choose Words. A word is any run of non-whitespace, so punctuation moves with it: Hello, world! becomes “world! Hello,” with the comma still attached.',
      question: 'How do I reverse word order without reversing letters?',
    },
    {
      answer:
        'With Whole text, line breaks move with the characters, so ab / cd → dc / ba. Each line keeps line endings in place and gives ba / dc. Code-point mode also turns a CRLF into LF followed by CR.',
      question: 'What happens to line breaks when I reverse characters?',
    },
    {
      answer:
        'It reverses the stored (logical) character order as for any script, so שלום abc → cba םולש. How the result looks depends on your app’s bidirectional display, so it may not look like a simple mirror image.',
      question: 'Does reversing work for Arabic or Hebrew text?',
    },
  ],
  help: 'Paste text or choose a sample, then choose Characters, Words or Lines.\n\nFor characters, start with Graphemes to keep accents and emoji sequences together. Use Unicode code points only when you want the underlying code-point order.\n\nCharacters and Words offer Whole text or Each line scope. Each line preserves the order and spelling of all CR, LF and CRLF terminators.\n\nWords are non-whitespace blocks, not language-aware dictionary words. Punctuation remains attached to its block. Decide whether separator slots stay in place or reverse with the blocks.\n\nLines reverses physical line bodies while retaining the original separator-slot terminators. Empty lines participate. No normalization, trimming or extra terminator is applied.\n\nRun, inspect the output, then copy, insert or save reversed-text.txt. Empty and whitespace-only input are valid. The exported file is exactly the result, without a summary footer.',
  notes: [
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines. NUL and unpaired surrogates are rejected; empty input is valid.',
    'Graphemes use the runtime’s Intl.Segmenter. Unicode-data versions can affect newly introduced character sequences. A runtime without segmentation shows an error rather than silently falling back to code points.',
    'Unicode code points are not UTF-16 code units. This option never splits a surrogate pair, but it intentionally can split grapheme clusters. Whole-text code-point reversal changes CRLF to LFCR.',
    'No Unicode normalization, accent removal, case conversion or whitespace cleaning is performed. Right-to-left display may look different from the logical string order.',
    'Word boundaries use JavaScript whitespace (\\s), including NBSP and line breaks. Text without whitespace, such as a Chinese phrase, is one block; this is not linguistic word segmentation.',
    'In Lines mode, CR, LF and CRLF stay in original separator positions instead of traveling with their old line body. A trailing empty sentinel is not an extra physical line. An initial empty line can become an empty last body, making an existing separator appear at the end.',
    'Whole-text grapheme reversal can move a final newline to the beginning. Use Each line to keep line breaks in place. Reversing twice is not a universal round-trip guarantee: grapheme boundaries or terminal empty-line representation can change after concatenation.',
    'Untouched samples and VS Code drafts retain raw line endings. Browser textareas normalize user-edited text to LF; those edited values are the actual input.',
    'Only controls relevant to the selected mode are shown and validated. Samples reset all four settings. Copy, insert and TXT export preserve the exact output, including whitespace-only or empty results.',
  ],
};
