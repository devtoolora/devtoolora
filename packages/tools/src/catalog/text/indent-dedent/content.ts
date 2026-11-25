import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Indentation is the literal leading spacing before a line body. This tool adds chosen ASCII spaces or tabs, removes them from the start, or removes the exact prefix shared by all nonblank lines.',
        'Spaces and tabs are different characters. A tab’s displayed width depends on the destination; this tool does not convert it into a guessed number of spaces.',
      ],
      title: 'What is indentation?',
    },
    {
      content: [
        'Shift copied code or plain text by a known number of spaces or tabs.',
        'Remove up to a requested indentation amount, or require an exact matching prefix.',
        'Remove a copied block’s common literal indentation while retaining relative nesting.',
        'Inspect invisible spacing before replacing input or exporting.',
      ],
      title: 'When to use Indent/Dedent Text',
    },
  ],
  examples: [
    'Indent 2 spaces: "one" → "  one".',
    'Dedent up to 2 spaces: " one" → "one"; Exact amount leaves that one-space prefix unchanged.',
    'Dedent up to 2 spaces: "\\tone" / "  two" → "\\tone" / "two"; Spaces mode never removes a tab.',
    'Common prefix: "  one" / "    two" → "one" / "  two".',
    'Common prefix: "\\t one" / "  two" → unchanged; a tab and spaces share no literal indentation.',
  ],
  faq: [
    {
      answer:
        'Choose Remove common prefix. It removes the indentation shared by every non-blank line and keeps relative nesting, so lines indented by 4 and 8 spaces end up at 0 and 4.',
      question: 'How do I remove the indentation from copied code?',
    },
    {
      answer:
        'Dedent removes only the selected unit: with Spaces, a tab-indented line keeps its tab while “  two” becomes “two”. Choose Tabs to remove tab indentation. Tabs are never converted to spaces or the other way round.',
      question: 'Why didn’t Dedent remove my tabs?',
    },
    {
      answer:
        'The shared prefix is compared character by character. If any non-blank line has no indentation, or one line starts with a tab and another with spaces, there is no common prefix and the text stays unchanged.',
      question: 'Why does Remove common prefix change nothing?',
    },
    {
      answer:
        'Up to amount removes as many of the selected characters as are present, at most Amount. Exact amount removes them only when the full Amount is present, so with 2 spaces “ one” stays unchanged while “  two” → “two”.',
      question: 'What is the difference between Up to amount and Exact amount?',
    },
    {
      answer:
        'Not by default: empty and whitespace-only lines are skipped, so no trailing whitespace is added. Choose Include under Blank lines to indent them too.',
      question: 'Are blank lines indented?',
    },
  ],
  help: 'Paste physical lines or choose a complete sample. Empty, whitespace-only and zero-amount inputs are valid.\n\nIndent/Dedent: choose Spaces or Tabs and Amount. For Dedent, choose Up to amount or Exact amount.\n\nRemove common prefix computes the longest shared ASCII-space/tab prefix of nonblank lines. Unit, Amount and partial-match drafts are hidden and ignored. A nonindented nonblank line means no shared prefix.\n\nChoose Skip or Include blank lines. Inspect Visible whitespace or Changes; the TXT is raw transformed text without marker glyphs.\n\nRun and inspect space/tab counts and the actual common prefix before replacing input. Save indented-text.txt or choose JSON audit and save indentation-report.json. Samples reset all six fields.',
  notes: [
    'Only ASCII U+0020 spaces and U+0009 tabs are indentation. NBSP, narrow NBSP and other Unicode whitespace remain content. No interior/trailing whitespace is changed unless the whole body consists of eligible leading indentation.',
    'Blank rows are skipped by default. Include is explicit and affects real physical rows only; an empty terminal sentinel after a final newline is not a new row to indent.',
    'Fixed Dedent stops at the first different character. Up to removes at most Amount consecutive chosen characters; Exact removes only a full requested prefix. Space and tab modes do not substitute for each other.',
    'Common prefix compares literal characters, not visual columns or minimum indentation width. Blank rows do not determine the shared prefix. If there are no nonblank rows or any nonblank row begins without indentation, the prefix is empty and no change occurs.',
    'Relative indentation is retained when removing the shared prefix. Include blank rows removes that exact prefix only when present, leaving shorter or differently ordered blank indentation untouched.',
    'Raw CR, LF, CRLF and absence of a final terminator are retained. Dedenting blank bodies can expose adjacent CR/LF as one CRLF or make an unterminated blank result empty; the summary warns if physical line counts change.',
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines, Amount to 0–64 and output to 1,000,000 UTF-16 units. NUL, unpaired surrogates and invalid active settings are rejected rather than clamped or silently defaulted.',
    'Untouched samples and VS Code source drafts retain raw terminators. Edited browser textareas normalize endings to LF and that edited value becomes the actual input.',
    'Visible markers are not escaping: literal dots or arrows can resemble the preview glyphs. Changes or Result text shows the original characters. The audit contains unmarked original text, transformed text, counts and comparison.',
    'The comparison starts with 100 rows. If its text/line/diff budget is exceeded, indentation still succeeds and the audit records the reason. No visual markers or statistics footer enter the TXT.',
    'This is not a syntax-aware formatter, tab-to-space converter or automatic language indentation detector. Whitespace is meaningful in Python, YAML, Markdown and other formats; inspect before replacing source.',
  ],
};
