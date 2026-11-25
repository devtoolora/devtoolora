import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A text diff compares two versions and aligns matching lines around insertions and deletions. Adding one line should not make every following line appear changed.',
        'This tool finds a shortest line insertion/deletion script with a bounded Myers search. Replacements count as one removed and one added line; adjacent change blocks are paired by position for display, not by semantic similarity.',
        'Both source versions, one-based physical line numbers and exact line-ending labels remain available in the report.',
      ],
      title: 'What is a text diff?',
    },
    {
      content: [
        'Compare configuration files, logs or prose before and after editing.',
        'Find inserted, removed or replaced lines without losing alignment.',
        'Check CRLF/LF differences or a missing final newline.',
        'Use explicit ignore options to focus on content while retaining the original text in exports.',
      ],
      title: 'When to use Text Diff',
    },
  ],
  examples: [
    'Before: one / three; After: one / two / three → only two is added, three stays aligned.',
    'Before: PORT=3000; After: PORT=8080 → one removed line plus one added line, paired as a changed row.',
    'Before: same + CRLF; After: same + LF → one changed row by default; one Equivalent row with Ignore line endings.',
    'With Ignore spaces and tabs: "  hello   world " vs "hello world" → Equivalent; both originals are kept.',
    'With Ignore letter case: Hello vs hello → Equivalent; Straße vs STRASSE is Equivalent too (full Unicode case mapping).',
  ],
  faq: [
    {
      answer:
        'It compares whole lines. In a changed row, the shared start and end stay plain and only the differing middle is highlighted; it is not a word-by-word diff.',
      question: 'Does Text Diff compare words or characters?',
    },
    {
      answer:
        'Trailing spaces, letter case and line endings all count by default, so “same” ending in CRLF differs from “same” ending in LF. Line-ending labels show the difference; enable an Ignore option to match such lines as Equivalent.',
      question: 'Why are lines that look identical marked as changed?',
    },
    {
      answer:
        'No. A moved line appears as a removal where it was and an addition where it is now: a / b / c → b / c / a shows a removed at the top and added at the bottom.',
      question: 'Does it detect moved lines?',
    },
    {
      answer:
        'Yes. Ignore letter case compares uppercase forms of the lowercased lines, so full Unicode case mappings match: Straße and STRASSE, or σ and ς, are Equivalent. Accents still count, and no language-specific rules, such as Turkish casing, are applied.',
      question: 'Does Ignore letter case treat Straße and STRASSE as equal?',
    },
    {
      answer:
        'No. Exports are a JSON report or a readable report listing every row, not a unified diff for git apply or patch.',
      question: 'Can I export a patch file?',
    },
    {
      answer:
        'No. Both texts are compared inside the app on your device; the tool makes no network requests.',
      question: 'Are my texts uploaded for comparison?',
    },
  ],
  help: 'Paste the original text into Before and the edited version into After. Either can be empty.\n\nChoose side-by-side, unified, JSON or readable report output. Enable ignore options only when those differences are irrelevant.\n\nRun the comparison. Line numbers are independent for each source. Added/removed labels complement color; line-ending labels expose invisible differences.\n\nIn a replaced line, the common prefix and suffix stay plain while the changed middle is highlighted without splitting Unicode code points. This is not a semantic word diff.\n\nFilter to changed rows or show more rows. Exports always include the full accepted comparison, regardless of the visible page or filter.\n\nCopy or save text-diff.json for structured data. Select Readable report and run again to copy or save text-diff.txt on any platform. Neither report is a Git/apply patch.',
  notes: [
    'Runs locally. Source and result text is rendered as text, not executable HTML.',
    'Each side supports up to 100,000 UTF-16 units and 10,000 physical lines. Empty text has zero lines; a trailing terminator belongs to its line, not a phantom extra line.',
    'Recognizes CRLF, LF and CR as physical line endings. Unicode paragraph/line separator characters remain ordinary content. NUL and unpaired surrogates are rejected.',
    'Browser textarea editing and pasting normalize line endings to LF. Untouched samples and saved field values retain their original endings. This compares accepted text, not original file bytes; use a byte-level comparison for exact file verification.',
    'Exact comparison is the default: whitespace, case, accents and line endings matter. Ignore options affect matching only; exported source text is never normalized.',
    'Equivalent rows may contain different originals when ignore options are enabled. The summary counts these separately, and the visual view labels them Equivalent rather than identical.',
    'Common prefixes/suffixes and completely disjoint line sets use exact fast paths. Ambiguous remaining comparisons permit up to 1,024 insertion/deletion steps and 2,000,000 search/comparison steps. Exceeding a budget is an error, never a guessed or partial diff.',
    'Repeated lines can admit several equally short alignments. The result is deterministic but is not guaranteed to match Git, a patience diff or another editor.',
    'Changed rows pair adjacent removals and additions by order. This pairing is visual only; counts and exports retain both complete originals. Moved text is shown as removal plus addition.',
    'Highlights cover the changed middle after shared code-point prefixes/suffixes. They are not word-level edits or grapheme-aware typography, and line-ending-only changes can have no highlighted characters.',
    'The view starts with 100 rows. JSON export contains all rows, comparison options and both exact source strings. The readable report JSON-quotes line text so spaces, tabs and control characters remain distinguishable.',
  ],
};
