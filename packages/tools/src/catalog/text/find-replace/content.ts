import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Find & Replace searches the original input and builds new text from non-overlapping matches. Inserted replacements are not searched again during the same run.',
        'Literal mode treats both Find and Replacement as exact text. Regex mode interprets a JavaScript pattern and lets you choose literal replacement or JavaScript substitution tokens.',
      ],
      title: 'What is Find & Replace?',
    },
    {
      content: [
        'Rename repeated words or literal punctuation without treating them as regex syntax.',
        'Remove text with an empty replacement, or replace only the first occurrence.',
        'Rearrange regex captures with numbered or named replacement tokens.',
        'Inspect changed lines and line endings before copying, replacing input or saving.',
      ],
      title: 'When to use Find & Replace',
    },
  ],
  examples: [
    'Literal find "." with replacement "!": a.b.c → a!b!c; periods only, not every character.',
    'Literal replacement "$&" for find ".": a.b.c → a$&b$&c; the match is not repeated.',
    'Default case-insensitive find "tools" with replacement "world": Hello tools, TOOLS → Hello world, world.',
    'Regex (\\w+), (\\w+) with tokens $2 $1: Lovelace, Ada → Ada Lovelace.',
    'Regex ^ERROR: with extra flags mu and replacement WARN:: ERROR: one / INFO / ERROR: two → WARN: one / INFO / WARN: two.',
    'Empty replacement for find "remove": remove → an empty result.',
  ],
  faq: [
    {
      answer:
        'Not by default: finding tools in “Hello tools, TOOLS” replaces both. Check Distinguish letter case for exact-case matching. The replacement is inserted exactly as typed; it does not copy the capitalization of the match.',
      question: 'Is Find & Replace case-sensitive?',
    },
    {
      answer:
        'Enable Use regular expression and keep Replacement interpretation on JavaScript tokens. Then (\\w+), (\\w+) with $2 $1 turns Lovelace, Ada into Ada Lovelace; $<name> inserts a named group and $& the whole match.',
      question: 'How do I use capture groups in the replacement?',
    },
    {
      answer:
        'Tokens such as $1 are interpreted only in regex mode with Replacement interpretation set to JavaScript tokens. In literal mode, or with Literal text selected, the replacement is inserted character for character.',
      question: 'Why does $1 appear literally in my result?',
    },
    {
      answer:
        'To match a line break, enable regex mode and use \\n or \\r?\\n in Find. To insert one, press Enter inside Replacement; typing \\n there inserts a backslash and the letter n.',
      question: 'How do I replace line breaks or insert a new line?',
    },
    {
      answer:
        'Occurrence controls g (All matches) and Distinguish letter case controls i, so Extra regex flags accepts only m, s, u and v. The default value u turns on Unicode mode.',
      question: 'Why are the g and i flags rejected?',
    },
    {
      answer:
        'No. All matches are found once in the original text, so replacing a with aa in aa gives aaaa instead of repeating forever.',
      question: 'Does it search the text it has just inserted?',
    },
  ],
  help: 'Paste source text and a Find value or apply a complete sample. Empty source is valid; only literal mode requires nonempty Find.\n\nChoose literal or regex matching, letter-case sensitivity and First or All matches.\n\nIn regex mode, choose extra flags and replacement interpretation explicitly. Use Regex Tester to inspect captures or unfamiliar patterns.\n\nRun and inspect the Changes view. It shows before/after line bodies and terminators; Copy and Save still use exact replaced text. JSON audit exports source, result, counts, options and available comparison instead.\n\nChanging input or fields invalidates the old result. Save replaced-text.txt or choose JSON audit and save replacement-report.json. Samples reset all eight fields.',
  notes: [
    'Web, desktop view and VS Code webview use a fresh isolated worker, stopped after two seconds including startup. Timeout produces no partial result and later runs use a fresh worker. Synchronous programmatic consumers must provide their own deadline/isolation for regex patterns.',
    'Literal mode treats special characters as text and always uses Unicode matching. Hidden regex-only settings are ignored. Case-insensitive matching follows JavaScript RegExp semantics, not language-specific casing or full Unicode case folding.',
    'Regex mode uses JavaScript, not PCRE or Python. g and i are derived from occurrence/case controls; extra flags accept m s u v only. Feature support, including v, depends on the installed runtime.',
    'First means one leftmost match. All means successive non-overlapping matches in the original source; it never repeatedly processes newly inserted text. Empty regex and other zero-width patterns advance correctly under the selected Unicode mode.',
    'Token substitution uses the same collected matches as counting. Missing captures follow JavaScript rules; $$ inserts a dollar sign. Literal replacement disables every substitution token even in regex mode.',
    'Input is limited to 100,000 UTF-16 units, Find and Replacement to 4,000 each, literal matches to 10,000, regex matches to 1,000 and result to 1,000,000 units. Oversized or invalid input is rejected without silent truncation.',
    'NUL and unpaired surrogates are rejected in input and output. Without u/v, regex patterns can split emoji into surrogate units; choose Unicode mode if a replacement would leave an invalid half-character.',
    'Unmatched text, spaces and line endings remain exact. Matching a line terminator or supplying actual newlines in Replacement can intentionally change line structure. No escaping, trimming, normalization or code syntax validation is performed.',
    'Untouched samples and VS Code source drafts retain raw CR/LF terminators. Edited browser textareas normalize newlines to LF, including Find and Replacement fields.',
    'Comparison displays 100 aligned rows at a time. If its text, line or diff-complexity budget is exceeded, replacement still succeeds; the exact result and comparison-unavailable reason remain in the audit.',
    'A match count is the number of replacement operations, not necessarily changed characters or rows. An identical replacement can leave the result unchanged. Audit files contain the original source and replacement result; TXT files contain only exact output.',
  ],
};
