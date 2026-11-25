import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Whitespace includes spaces, tabs and line breaks. Cleaning it can improve pasted prose, but it can also change code indentation, Markdown hard breaks or the meaning of a non-breaking space.',
        'The default removes trailing ASCII spaces and tabs and keeps at most one consecutive blank line. It preserves indentation, interior spacing, Unicode spaces and each original CR, LF or CRLF terminator.',
      ],
      title: 'What is whitespace cleaning?',
    },
    {
      content: [
        'Remove accidental trailing spaces from logs or copied text.',
        'Reduce long gaps between paragraphs without joining the paragraphs.',
        'Normalize line endings deliberately when a destination requires LF or CRLF.',
        'Inspect before-and-after spacing in configuration or code; enable indentation removal only when it is intended.',
      ],
      title: 'When to use Whitespace Cleaner',
    },
  ],
  examples: [
    'Default: "  hello  " → "  hello"; indentation stays intact.',
    'Collapse interior spaces and tabs: "  hello   world" → "  hello world".',
    'Three consecutive empty physical lines → one empty line, preserving paragraph separation.',
    'LF normalization: "one\r\ntwo\r" → "one\ntwo\n"; no final newline is added if none existed.',
    'Normalize Unicode spaces: hello + U+00A0 + world → "hello world" with an ordinary space; the default leaves NBSP unchanged.',
  ],
  faq: [
    {
      answer:
        'Not with the defaults: they only remove trailing spaces and tabs and keep at most one blank line in a row, so leading indentation stays. Trim both ends of each line removes indentation, so enable it only for prose.',
      question: 'Will Whitespace Cleaner break my code indentation?',
    },
    {
      answer:
        'Per-line cleanup only touches ASCII spaces and tabs. Enable Normalize Unicode spaces to turn NBSP (U+00A0), narrow NBSP (U+202F) and other Unicode spaces into ordinary spaces that the other options then clean.',
      question: 'Why are non-breaking spaces not removed?',
    },
    {
      answer:
        'Set Line endings to LF; every existing CRLF and CR becomes LF, and CRLF does the reverse. A final newline is not added when the text did not end with one.',
      question: 'How do I convert CRLF line endings to LF?',
    },
    {
      answer:
        'Markdown uses two trailing spaces as a hard line break, and the default removes trailing spaces. Uncheck Remove trailing spaces and tabs to keep them.',
      question: 'Why did my Markdown line breaks disappear?',
    },
    {
      answer:
        'Yes. It applies JavaScript trimming to the whole result, so leading and trailing newlines, tabs, NBSP and a byte-order mark (U+FEFF) are removed too. Zero-width spaces (U+200B) are not.',
      question: 'Does Trim whole-text edges remove more than spaces?',
    },
  ],
  help: 'Paste text or apply a sample. Defaults preserve indentation, internal spacing and original line-ending types.\n\nEnable only the transformations you need. Line trimming removes indentation; whole-text trimming can remove the last newline and leading indentation of the first line.\n\nVisible whitespace compares the original and cleaned text with space/tab markers. Line headers show CR, LF, CRLF or No newline; Changes displays actual glyphs. Copy and Save in either view still use raw cleaned text.\n\nChoose Cleaned text for the exact copy-ready output. Empty and whitespace-only input are valid, and an empty result can be saved.\n\nRun the tool, inspect changed rows and statistics, then copy, insert or save cleaned-text.txt. Choose JSON report and run again to copy/save original text, cleaned text, counts and the complete available comparison on every platform.\n\nApplying a sample resets every setting. No preview markers, statistics footer or extra newline is added to the cleaned TXT.',
  notes: [
    'Processing order: Unicode-space normalization → per-line trimming → interior space/tab collapse → consecutive blank-line reduction → line-ending conversion → whole-text trimming.',
    'Only ASCII spaces and tabs are per-line whitespace by default. NBSP and other Unicode horizontal spaces remain unless normalization or whole-text edge trimming explicitly changes them.',
    'Unicode normalization covers U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F and U+3000. It does not remove BOM, zero-width characters or Unicode line separators.',
    'Preserve retains each surviving line’s original terminator. Existing final newlines remain unless their blank line is removed or whole-text trimming is enabled; no final newline is synthesized.',
    'Browser textareas normalize user-edited line endings to LF. Untouched bundled samples and VS Code drafts retain raw terminators for processing and export.',
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines. CRLF conversion can increase output length by one unit per converted terminator. NUL and unpaired surrogates are rejected; emoji and valid Unicode text are preserved.',
    'Counts use Unicode code points for characters, ASCII spaces/tabs for their totals and physical terminated or nonempty final lines for line counts. An empty terminal sentinel is not another physical line.',
    'The preview initially shows 100 aligned rows and supports filtering and Show more. If a large or ambiguous diff exceeds its comparison limits, cleaning still succeeds with exact output and the JSON report explains why the comparison is unavailable.',
    'Visible markers are not escaping: a literal dot or arrow in the source can look like a marker. Use Changes or Cleaned text to distinguish original characters. This tool does not parse or validate code, JSON or Markdown.',
  ],
};
