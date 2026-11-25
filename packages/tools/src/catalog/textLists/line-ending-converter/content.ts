import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Text files end lines with different invisible terminators: LF on Unix and macOS, CRLF on Windows and CR on very old Mac systems. A file can also start with a byte order mark (BOM, U+FEFF), a marker some Windows tools write at the start of UTF-8 text.',
        'This tool counts every kind of terminator, converts them all to the one you choose and adds or removes the BOM. Everything runs locally in your browser or editor.',
      ],
      title: 'What are line endings and a BOM?',
    },
    {
      content: [
        'Normalize a file edited on several systems so Git stops showing whole-file diffs.',
        'Convert LF to CRLF for scripts and CSV files that Windows tools expect.',
        'Add a BOM so Excel opens a UTF-8 CSV with the right encoding, or remove one that breaks a shebang line or JSON parser.',
        'Check a sample with Keep selected to see how many LF, CRLF and CR terminators it contains.',
      ],
      title: 'When to use Line Ending & BOM Converter',
    },
  ],
  examples: [
    'Mixed to LF: a, CRLF, b, CR, c, LF → a, b, c each ending in LF.',
    'LF to CRLF: first\\nsecond → first\\r\\nsecond.',
    'Add BOM: name,city → U+FEFF followed by name,city.',
    'Remove BOM: U+FEFF followed by x → x.',
    'Report only: Keep line endings and Keep BOM show the counts and leave the text identical.',
  ],
  faq: [
    {
      answer:
        'Browser textareas normalize every newline to LF as soon as you edit the text. Untouched samples and VS Code drafts keep their raw terminators, and the saved converted.txt always carries the exact result.',
      question: 'Why does the browser show only LF after I edit the input?',
    },
    {
      answer:
        'A byte order mark is the character U+FEFF at the very start of a text. In UTF-8 it is optional and only signals the encoding. Excel often needs it to read UTF-8 CSV, while shell scripts and JSON parsers usually reject it.',
      question: 'What is a BOM?',
    },
    {
      answer:
        'Use LF for Git repositories, Linux, macOS and most web code, and let .gitattributes handle checkouts on Windows. Use CRLF for Windows batch files and for tools that explicitly require it. CR alone is only needed for legacy systems.',
      question: 'Which line ending should I choose for Git or Windows?',
    },
    {
      answer:
        'CRLF is one terminator made of two characters, so counting it as LF plus CR would be misleading. Separate counts also reveal mixed endings, which cause noisy diffs and subtle parser bugs.',
      question: 'Why are three kinds of terminators counted?',
    },
  ],
  help: 'Paste text or choose a sample, then pick the line ending and the BOM action.\n\nLF, CRLF and CR rewrite every terminator in the text to the chosen kind. Keep leaves terminators untouched and only reports the counts.\n\nBOM Keep leaves the start of the text as it is. Add puts U+FEFF at the start unless one is already there, and Remove drops it.\n\nThe summary lists the LF, CRLF and CR counts, tells whether the endings are mixed, whether a BOM was present and whether the text changed.\n\nCopy the result, insert it into the editor, or save converted.txt.',
  notes: [
    'Input is limited to 1,000,000 UTF-16 units; larger input is rejected with a message naming the limit.',
    'Untouched samples and VS Code source drafts retain raw terminators. Edited browser textareas normalize newlines to LF, so the converted.txt download is the exact result.',
    'Only CRLF, CR and LF are line terminators here. Unicode separators such as U+2028, U+2029 and U+0085 are left unchanged.',
    'The mixed flag is set when more than one kind of terminator has a non-zero count.',
    "In VS Code, Replace and Insert adopt the document's end-of-line setting. Use the converted.txt download for exact bytes, or change the EOL in the status bar.",
  ],
};
