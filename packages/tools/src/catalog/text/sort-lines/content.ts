import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Line sorting rearranges complete physical line bodies. The comparison rules determine what ascending and descending mean; they do not rewrite the original spelling, spacing or Unicode.',
        'Locale-aware sorting uses the chosen language’s collation. Natural number groups place item2 before item10. Unicode code-point comparison gives an explicit non-linguistic order independent of language collation.',
      ],
      title: 'What is line sorting?',
    },
    {
      content: [
        'Order filenames, labels or identifiers with natural digit-group ordering.',
        'Sort Czech or other language-specific lists without relying on the device’s default locale.',
        'Keep, move or explicitly remove empty spacing lines.',
        'Create a reproducible code-point-sorted list, or compare text without outer ASCII padding while retaining that padding in the result.',
      ],
      title: 'When to use Sort Lines',
    },
  ],
  examples: [
    'Natural number groups: item10 / item2 / item1 → item1 / item2 / item10.',
    'Without natural groups: item1 / item10 / item2 stays in lexical digit order.',
    'Czech locale cs: chata / had / cena / čaj → cena / čaj / had / chata; English en gives čaj / cena / chata / had.',
    'Ignore edge spaces for comparison: "  beta  " / "alpha" → "alpha" / "  beta  "; output padding remains.',
    'Descending with accents ignored: zebra / RESUME / résumé / resume → unchanged; equal keys keep their input order.',
  ],
  faq: [
    {
      answer:
        'Natural number groups is on by default, so digit runs compare by value: item10 / item2 / item1 → item1 / item2 / item10. Uncheck it for character order, which gives item1 / item10 / item2.',
      question: 'Why does item10 sort after item2?',
    },
    {
      answer:
        'Not by default: b / A / a / B → A / a / b / B, with equal letters kept in input order. Distinguish letter case gives a / A / b / B, and Unicode code points puts every capital first: A / B / a / b.',
      question: 'Is sorting case-sensitive?',
    },
    {
      answer:
        'Collation follows the chosen language. With Swedish (sv), ä is a separate letter after z, so ä / z / a → a / z / ä; with German (de) it sorts next to a, giving a / ä / z.',
      question: 'Why does ä sort after z?',
    },
    {
      answer:
        'No. Natural groups compare digit runs, while minus signs and decimal points stay text, so -5 / 10 / 2.5 / -10 / 2.25 → -5 / -10 / 2.5 / 2.25 / 10.',
      question: 'Can it sort negative or decimal numbers numerically?',
    },
    {
      answer:
        'No, every line is kept, including repeated ones. Run Deduplicate Lines before or after sorting to keep one copy of each entry.',
      question: 'Does Sort Lines remove duplicates?',
    },
    {
      answer:
        'Any BCP 47 tag that the runtime’s Intl.Collator supports, such as en, cs, de-DE or sv. Unsupported tags are rejected instead of falling back to a default, and the summary shows the resolved locale (de-DE resolves to de).',
      question: 'Which collation locales can I enter?',
    },
  ],
  help: 'Paste one entry per physical line or apply a sample.\n\nChoose Ascending or Descending. Pick Locale-aware and enter a supported locale, or use Unicode code points for non-linguistic ordering.\n\nIn locale mode, choose natural digit groups, case and accent sensitivity. These controls do not change or deduplicate the source text.\n\nChoose how blank lines participate. Keep positions is the default; Remove is an explicit deletion of blank line bodies and their original terminators.\n\nIgnore edge spaces affects comparison keys only. Run, inspect the result and resolved-locale summary, then copy, insert or save sorted-lines.txt.\n\nEmpty and whitespace-only input are valid. Samples reset all eight settings. The TXT contains the exact sorted result with no summary footer or added line terminator.',
  notes: [
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines. NUL and unpaired surrogates are rejected; valid Unicode text is retained exactly.',
    'Comparison defaults are English en, natural digit groups, case-insensitive and accent-sensitive. Locale-aware results depend on runtime Unicode/CLDR data; use code points for language-independent ordering.',
    'Stable sorting preserves original order for equal comparison keys in both directions. Descending negates comparison results instead of reversing an ascending list.',
    'Natural groups use Intl.Collator numeric collation, not floating-point conversion. Minus signs, decimal points and exponent notation remain text; do not use this as a mathematical signed-number sort.',
    'Unicode code-point comparison is case-sensitive and non-numeric. Supplementary characters are compared by their full code point, not UTF-16 surrogate-unit order. Hidden locale-specific draft settings are ignored in this mode.',
    'Keep positions does not sort each paragraph independently. A blank line’s slot stays fixed while nonblank entries can cross paragraph boundaries. Move first/last is independent of sort direction and retains blank bodies in original order.',
    'Each surviving separator slot retains its original CR, LF, CRLF or absent terminator. Terminators do not travel with the old line body. Remove drops blank slots and their terminators; no normalization or new terminator is applied.',
    'An empty terminal sentinel is not an extra physical line. Moving an empty body to the last unterminated slot can make an existing separator appear as a final newline. Empty bodies placed between CR and LF slots can also join those bytes into one CRLF. The summary warns when the resulting physical line count changes beyond explicit blank removal. Normalize endings with Whitespace Cleaner first if uniform separators are required.',
    'Untouched samples and VS Code drafts retain raw terminators. Browser textareas normalize user-edited text to LF, and those edited values become the actual input.',
    'Duplicates are never removed. Case, accents, Unicode normalization and ignored padding affect only comparison. Empty-result TXT exports remain valid zero-byte files.',
  ],
};
