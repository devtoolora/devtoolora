import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A regular expression describes a text pattern. This tester uses the JavaScript RegExp engine, not PCRE, Python or a server-side implementation.',
        'Flags change matching behavior: g searches successive matches, i ignores case, m changes line anchors, s lets dot include newlines, u/v select Unicode modes, y is sticky and d exposes capture bounds.',
        'The visual report highlights full matches and lists numbered and named captures. Match positions are zero-based UTF-16 offsets with an exclusive end, not byte or grapheme positions.',
      ],
      title: 'What is a regular expression?',
    },
    {
      content: [
        'Debug extraction patterns against representative log or configuration text.',
        'Inspect optional and named groups instead of guessing what was captured.',
        'Compare first-match, global, multiline and Unicode behavior.',
        'Preview replacement tokens or use an empty replacement to remove matches.',
      ],
      title: 'When to use Regex Tester',
    },
  ],
  examples: [
    '(?<key>\\w+)=(?<value>\\w+) on PORT=3000 → key "PORT", value "3000".',
    '\\d+ on a1 b22 with g → 1 and 22; with no flags → only 1.',
    '^.+$ on a + LF + b with gm → a and b; with g only → no match.',
    '(?=a) with g on aa → two zero-width matches at offsets 0 and 1, shown as ∅ markers.',
    '(\\w+), (\\w+) with replacement $2 $1 → Lovelace, Ada becomes Ada Lovelace; $& inserts the full match and $$ a dollar sign.',
  ],
  faq: [
    {
      answer:
        'JavaScript RegExp from the browser, desktop app or VS Code runtime, not PCRE, Python or .NET. Lookbehind and named groups work, but PCRE-only syntax such as possessive a++ or atomic (?>…) groups is rejected as invalid.',
      question: 'Which regex flavor does Regex Tester use?',
    },
    {
      answer:
        'No. Enter only the pattern source, such as \\d+, and type flags in the Flags field. Slashes in Pattern are matched literally, so /\\d+/g finds nothing in abc 123.',
      question: 'Should I type the slashes and flags, like /\\d+/g?',
    },
    {
      answer:
        'Unicode property escapes need the u or v flag. Without it, \\p is an ordinary p, so the pattern matches the literal text p{L}; with gu it matches each letter, including é.',
      question: 'Why does \\p{L} match the text p{L} instead of letters?',
    },
    {
      answer:
        'Without the g flag only the first match is returned, so \\d+ on a1 b22 finds just 1. The Flags field starts as g; if you clear it, the tool does not add it back.',
      question: 'Why does my pattern find only one match?',
    },
    {
      answer:
        'Each run uses a separate worker that is stopped after 2 seconds, so a pattern like (a+)+$ on a long non-matching input ends with a time-limit error instead of freezing the app. The next run starts in a fresh worker.',
      question: 'What happens if a pattern causes catastrophic backtracking?',
    },
  ],
  help: 'Paste test text or apply a complete sample. Empty text is valid.\n\nEnter a JavaScript pattern without / delimiters and choose flags explicitly.\n\nRun Regex Tester. Visual mode highlights matches and shows their offsets and groups; JSON mode exposes the complete report.\n\nEnable Preview replacement to inspect the resulting text. An empty replacement deletes matches. No functions or evaluated replacement expressions are accepted.\n\nDownload regex-report.json for the complete report. When replacement preview is enabled, replaced.txt contains the exact replacement result, including an empty file.',
  notes: [
    'Runs locally. The web, desktop view and VS Code webview use a separate worker for each run, stopped after two seconds including startup. A timed-out run produces no partial result and does not poison subsequent runs.',
    'The reusable synchronous function does not itself interrupt a RegExp engine call. Programmatic consumers must provide their own isolated worker/deadline; size limits are not a guarantee against catastrophic backtracking.',
    'Supports 100,000 UTF-16 input units, 4,000 pattern/replacement units, 1,000 matches and 1,000,000 units of compact match data or replacement output. Exceeding a limit returns an error, not a truncated result.',
    'Unknown or duplicate flags are errors. u and v cannot be combined. Syntax and feature support, including v or d, depend on the installed JavaScript runtime.',
    'Without g only one match is returned. y starts at index zero and stops at the first gap; gy continues only over consecutive sticky matches. Zero-length global matches advance correctly, including Unicode code point boundaries in u/v mode.',
    'Without u or v, patterns such as dot can match individual UTF-16 surrogate units and split an emoji. The report retains those native offsets; use Unicode mode when matching full Unicode code points. A replacement containing unpaired surrogates is rejected because it cannot be exported exactly as UTF-8.',
    'Unmatched optional captures are null, not empty strings. Participating empty captures remain "". With d, indices lists full-match bounds followed by numbered capture bounds; unmatched bounds are null.',
    'Replacement follows JavaScript string substitution, including prefix/suffix tokens and numbered/named captures. Preview uses the same collected matches and does not evaluate the pattern a second time. It is not a template language or executable code.',
    'The visual view renders source and capture text as text, not HTML. It highlights full matches only, and shows 100 capture cards at a time; the JSON export always contains every accepted match.',
    'The report includes your original input and optional replacement output. No automatic regex correction, email validity check or cross-language conversion is performed.',
  ],
};
