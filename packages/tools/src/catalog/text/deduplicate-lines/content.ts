import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Line deduplication keeps one representative of each equal comparison key across the entire input. It does not sort the remaining lines.',
        'Choose the first or last occurrence. Remaining representatives stay in their original source order, with their original bodies and terminators.',
      ],
      title: 'What is line deduplication?',
    },
    {
      content: [
        'Clean repeated identifiers, labels or copied list entries.',
        'Keep the first spelling of a repeated entry, or retain its last occurrence.',
        'Compare padded entries or canonically equivalent Unicode spellings without rewriting the retained source text.',
        'Preserve blank spacing lines or explicitly remove them while deduplicating the content.',
      ],
      title: 'When to use Deduplicate Lines',
    },
  ],
  examples: [
    'Default: Alpha / beta / alpha → Alpha / beta.',
    'Keep last: Alpha / beta / alpha → beta / alpha; no sorting is performed.',
    'Case sensitive: ID / id / ID → ID / id.',
    'Ignore edge spaces: "  beta  " / beta / alpha → "  beta  " / alpha; the retained line keeps its padding.',
    'Normalize Unicode: café / cafe + U+0301 / cafe → café / cafe; without normalization all three remain.',
  ],
  faq: [
    {
      answer:
        'No. Unlike Unix uniq, which only collapses adjacent repeats, it removes repeats anywhere in the text: b / a / b / a → b / a. The remaining lines keep their original order; nothing is sorted.',
      question: 'Does it only remove duplicates that are next to each other?',
    },
    {
      answer:
        'Not by default: Alpha / beta / alpha → Alpha / beta, keeping the first spelling. Check Distinguish letter case when entries such as ID and id must stay separate.',
      question: 'Is the comparison case-sensitive?',
    },
    {
      answer:
        'Spaces are compared exactly, so x followed by two spaces and x are different lines. Enable Ignore edge spaces for comparison to treat them as duplicates; the kept line still has its original spacing.',
      question: 'Why aren’t lines with trailing spaces treated as duplicates?',
    },
    {
      answer:
        'No, accents are never ignored. Normalize Unicode for comparison only merges different encodings of the same character, such as é and e followed by U+0301. Run Strip Diacritics first if café and cafe should match.',
      question: 'Are café and cafe treated as duplicates?',
    },
    {
      answer:
        'By default blank lines are deduplicated like any other line, so a / blank / b / blank / c → a / blank / b / c. Choose Keep all to leave every blank line in place, or Remove all to delete them.',
      question: 'What happens to blank lines?',
    },
  ],
  help: 'Paste one entry per line, or choose a sample.\n\nChoose which occurrence survives, then set case sensitivity, edge-space comparison and optional canonical Unicode comparison.\n\nChoose whether blank lines are deduplicated, all retained or explicitly removed.\n\nRun and inspect the counts and retained spelling before replacing input. Changing input or settings invalidates the old result and export.\n\nCopy, insert or save deduplicated-lines.txt. Empty input and zero-byte results are valid; samples reset all five settings.',
  notes: [
    'Deduplication is global, not limited to adjacent rows. Remaining source order is preserved; use Sort Lines separately if sorting is wanted.',
    'Defaults preserve the existing case-insensitive behavior, keep the first occurrence and compare spaces and Unicode spelling exactly. Enable case sensitivity for identifiers whose letter case is significant.',
    'Case-insensitive comparison uses toLowerCase, not full Unicode case folding or a chosen language. For example, ß and SS remain distinct. It does not validate emails, URLs or identifiers.',
    'NFC comparison is opt-in and affects keys only. It merges canonically equivalent accents, not compatibility ligatures, accents with unaccented letters, or visually similar characters from different scripts.',
    'Blank classification includes only ASCII spaces/tabs. NBSP and zero-width characters remain content. Without edge-space comparison, empty, space-only and tab-only bodies may have different keys.',
    'A retained body keeps its own CRLF, CR, LF or absent terminator. Removed bodies lose their terminators. No trailing newline is added or removed separately; keeping first versus last can therefore change whether output ends in a newline.',
    'The empty sentinel after a final terminator is not an extra physical line. Removing intervening bodies can join a retained CR and LF into CRLF; the summary warns if the output physical count differs from retained records.',
    'Untouched samples and VS Code drafts preserve raw line endings. User-edited browser textareas normalize endings to LF; the edited text is then the actual source.',
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines. NUL and unpaired surrogates are rejected. The saved TXT is exact UTF-8 output, without statistics or a footer.',
  ],
};
