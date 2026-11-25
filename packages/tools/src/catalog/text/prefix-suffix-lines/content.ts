import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A prefix goes before each selected physical line body; a suffix goes after it, before its original line terminator.',
        'Add inserts literal text. Remove deletes at most one exact matching prefix and one suffix from their selected boundaries. The rest of each line stays unchanged.',
      ],
      title: 'What are line prefixes and suffixes?',
    },
    {
      content: [
        'Turn plain entries into Markdown bullets or blockquotes.',
        'Add comment markers after existing indentation without reformatting code.',
        'Wrap labels with fixed delimiters or append a fixed unit or ending.',
        'Remove known boundary markers, or fill in missing markers on a mixed list.',
      ],
      title: 'When to use Prefix/Suffix Lines',
    },
  ],
  examples: [
    'Add prefix "- ": one / two → - one / - two.',
    'After indentation: "  one" with prefix "// " → "  // one".',
    'Add only if missing: "- one" / "two" with prefix "- " → "- one" / "- two".',
    'Remove prefix "[" and suffix "]": [one] / two → one / two; unmatched boundaries remain.',
    'Prefix "> " with Include blank lines: one / (empty) / two → "> one" / "> " / "> two"; Skip leaves the empty row unchanged.',
  ],
  faq: [
    {
      answer:
        'Use Prefix " and Suffix ", to turn apple / banana into "apple", / "banana",. The last line gets a comma too, so remove it if your format does not allow a trailing comma.',
      question: 'How do I wrap every line in quotes and add a comma?',
    },
    {
      answer:
        'No. Prefix and Suffix are literal single-line text, so typing \\n inserts a backslash and the letter n. Use Find & Replace in regex mode for pattern-based edits.',
      question: 'Can I use \\n or regex syntax in the prefix?',
    },
    {
      answer:
        'Set Prefix to “// ” and Prefix placement to After indentation, so “  x();” → “  // x();”. Leading spaces and tabs stay in front of the marker.',
      question: 'How do I comment out code without breaking indentation?',
    },
    {
      answer:
        'Blank lines are skipped by default. Choose Include to affix them too: with prefix “> ”, one / blank / two → “> one” / “> ” / “> two”.',
      question: 'Why were blank lines left unchanged?',
    },
    {
      answer:
        'Yes with Always add: “- one” becomes “- - one”. Choose Add only if missing to add the prefix only where a line does not already start with it.',
      question: 'Will running it twice add the prefix twice?',
    },
    {
      answer:
        'Switch Mode to Remove. It deletes one exact, case-sensitive occurrence at the boundary, so with prefix “- ”, “- - item” → “- item”, and lines without the prefix stay unchanged.',
      question: 'How do I remove a prefix from every line?',
    },
  ],
  help: 'Paste physical lines or apply a sample.\n\nChoose Add or Remove and enter literal prefix and suffix text. An empty side is a no-op; both empty sides leave valid input unchanged.\n\nSelect Line start or After indentation, then Skip or Include blank lines. Add mode also offers Add only if missing.\n\nRun and inspect changed-line and boundary-change counts. Changing text or settings invalidates the previous result.\n\nCopy, insert or save affixed-lines.txt. Empty input and empty results are valid. Each sample resets all six fields.',
  notes: [
    'Matching is exact, case-sensitive and Unicode-spelling-sensitive. No regex, escaping, trimming, capitalization or normalization is applied. Literal $&, $1 and backslash-n remain literal text.',
    'Add only if missing checks prefix and suffix independently on the original body after any indentation split. Overlapping markers or affixes containing indentation are not a syntax parser or a universal idempotence guarantee.',
    'Remove processes the prefix first, then checks the remaining body for the suffix. Each side removes at most one occurrence; unmatched sides stay unchanged. Add and Remove are not guaranteed inverses when source text already contains matching markers.',
    'After indentation recognizes only leading ASCII spaces/tabs in the current input. Prefixes that themselves begin with whitespace can change where indentation ends on a later run.',
    'Blank-line eligibility is checked on the original body. Skip preserves its exact spaces, tabs and terminator. Include transforms actual blank rows, not an imaginary final sentinel.',
    'CRLF, CR, LF and the absence of a final terminator are preserved byte-for-byte. Removing content can expose adjacent CR/LF as one CRLF or turn a last empty body into a final newline; the summary warns if physical line counts change.',
    'Untouched samples and VS Code drafts retain raw terminators. User-edited browser textareas normalize line endings to LF and those edited values become the actual input.',
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines. Each affix is limited to 1,000 UTF-16 units and cannot contain CR, LF, NUL or unpaired surrogates. Output is limited to 1,000,000 UTF-16 units and is never silently truncated.',
    'The TXT export contains the exact result without summary text or an added newline. Large generated output may exceed the input limit for a later run. This is not HTML/SQL/shell escaping or a safe code generator; inspect generated syntax before using it.',
  ],
};
