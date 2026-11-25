import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Line numbering inserts a generated decimal label and a literal separator before each selected line body. It changes the actual output text, unlike an editor’s visual gutter.',
        'The sequence begins at Start number and advances by Step only when a line is numbered. Each original body, indentation and line terminator is otherwise retained.',
      ],
      title: 'What is line numbering?',
    },
    {
      content: [
        'Prepare numbered plain-text lists or annotate copied lines.',
        'Start a sequence at a chosen offset or create descending labels.',
        'Use zero-padded labels for fixed-width identifiers without truncating larger numbers.',
        'Keep blank spacing lines unnumbered, or insert labels after existing indentation.',
      ],
      title: 'When to use Number Lines',
    },
  ],
  examples: [
    'Default: one / two → 1. one / 2. two.',
    'Start 7, minimum digit width 3, separator "_": alpha / beta → 007_alpha / 008_beta.',
    'Start 3, step -1: a / b / c → 3. a / 2. b / 1. c.',
    'Start -2, step 2, width 3: a / b / c → -002. a / 000. b / 002. c.',
    'Skip blank lines: one / blank / two → 1. one / unchanged blank / 2. two.',
  ],
  faq: [
    {
      answer:
        'Set Start number to any whole number, including 0 or a negative value; Step sets the increment, and a negative step counts down. Fractions such as 1.5 are rejected.',
      question: 'How do I start numbering at 0 or another number?',
    },
    {
      answer:
        'Set Minimum digit width to 3 so 1 becomes 001. Larger numbers are never cut: starting at 999 with width 3 gives 999 and then 1000.',
      question: 'How do I get zero-padded numbers like 001?',
    },
    {
      answer:
        'Change Separator, which is literal text placed right after the number: “) ” gives 1) one and “: ” gives 1: one. To add text before the number, run Prefix/Suffix Lines on the result.',
      question: 'How do I change the format to 1) or 1:?',
    },
    {
      answer:
        'No, it adds a second label: 1. one → 1. 1. one. Remove the old numbers first, for example with Find & Replace in regex mode using ^\\d+\\.\\s and extra flags mu.',
      question: 'Will it renumber a list that is already numbered?',
    },
    {
      answer:
        'Yes. Set Blank lines to Skip: one / blank / two → 1. one / blank / 2. two. Skipped lines do not use up a number.',
      question: 'Can blank lines be left unnumbered?',
    },
  ],
  help: 'Paste one item per physical line or apply a sample.\n\nSet Start number, Step and Minimum digit width. Inspect the negative-number and descending samples if needed.\n\nChoose a literal Separator, then Number or Skip blank lines and Line start or After indentation placement.\n\nRun and inspect numbered/skipped counts and the first-to-last number range. Changing input or settings invalidates the previous result and export.\n\nCopy, insert or save numbered-lines.txt. Empty input and all-blank skipped input are valid. Samples reset all six fields.',
  notes: [
    'Start, step and every generated label must be safe integers from -9007199254740991 through 9007199254740991. Sequence arithmetic is exact; an out-of-range label rejects the whole result instead of rounding, clamping or exporting a partial list.',
    'Minimum width counts magnitude digits only, not the minus sign. Zero has no minus sign. Leading zeros in a numeric setting are canonicalized; use the width setting to request output padding.',
    'Blank lines are numbered by default. Skip recognizes only empty/ASCII-space/tab-only bodies; NBSP and zero-width characters remain content and receive a number.',
    'Only real physical lines are processed. A final CRLF, CR or LF is preserved and does not create another numbered row. Empty input has zero rows. No body, gap, final newline or terminator spelling is normalized.',
    'After indentation recognizes leading ASCII spaces/tabs in each current body. It preserves those characters and all trailing spaces verbatim.',
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines. Width is limited to 1–20, separator to 1,000 UTF-16 units and output to 1,000,000 UTF-16 units. NUL, unpaired surrogates and CR/LF inside the separator are rejected.',
    'Untouched samples and VS Code drafts retain raw terminators. User-edited browser textareas normalize endings to LF; the edited value is then the actual input.',
    'Existing numbers are not detected or replaced. Running numbered output again adds another label. This is not automatic Markdown numbering, a syntax-aware renumberer or escaping for HTML/SQL/shell text.',
    'The TXT export is the exact UTF-8 result without statistics or an added footer. Large generated output can exceed the input limit if reused in a later run.',
  ],
};
