import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The same visible text can be stored as different code point sequences. An accented letter such as é is either one code point (U+00E9) or an e followed by a combining acute accent (U+0065 U+0301). Both look identical but compare as different strings.',
        'Unicode normalization rewrites text into one canonical form so that equal-looking text becomes byte-equal. Everything runs locally in your browser or editor.',
      ],
      title: 'What is Unicode normalization?',
    },
    {
      content: [
        'NFC composes sequences into precomposed characters and is the usual form for storage and the web. NFD decomposes them into base letters plus combining marks, which is handy for comparison and accent handling.',
        'NFKC and NFKD additionally apply compatibility mappings: ligatures, circled digits, full-width letters and similar variants become their plain equivalents, which loses some formatting information.',
        'Report preview lists up to the first 100 changed graphemes with the code points before and after.',
      ],
      title: 'Choosing a form',
    },
  ],
  examples: [
    'NFC: e + U+0301 → U+00E9 (é)',
    'NFD: U+00E9 → U+0065 U+0301',
    'NFKC: ﬁ (U+FB01) → fi',
    'NFKD: ① (U+2460) → 1',
    'NFKC: ＡＢＣ (full-width) → ABC',
  ],
  faq: [
    {
      answer:
        'NFC joins a base letter and its combining marks into one precomposed code point where one exists, NFD splits them apart. They represent the same text; NFC is shorter and is the common storage form, NFD is useful for comparison.',
      question: 'What is the difference between NFC and NFD?',
    },
    {
      answer:
        'Use NFKC when you want to treat look-alike variants as the same, for example for search keys, identifiers or usernames. Do not use it for text you must preserve exactly, because the compatibility mappings are lossy.',
      question: 'When should I use NFKC?',
    },
    {
      answer:
        'Compatibility forms replace characters such as the ﬁ ligature, circled digits or full-width letters with their plain equivalents. Canonical forms NFC and NFD never change ligatures.',
      question: 'Why does NFKC change ligatures?',
    },
    {
      answer:
        'Strip diacritics removes the accents and returns different letters. Normalization keeps every accent and only changes how it is encoded, so the text still reads the same.',
      question: 'Why is this not the same as stripping diacritics?',
    },
  ],
  help: 'Pick a normalization form and paste your text. The result keeps the text you typed, only rewritten into the selected form.\n\nThe summary shows how many graphemes changed and how the code point count moved, for example 5 → 4 when a decomposed accent is composed.\n\nSwitch Preview to Report to get a JSON list of the changed graphemes with their code points before and after, such as U+0065 U+0301 → U+00E9.\n\nEmpty input is valid and returns empty output.',
  notes: [
    'Input is limited to 100,000 UTF-16 units and the result to 1,000,000 UTF-16 units; NUL and unpaired surrogates are rejected.',
    'The output is the exact normalization of the whole input. Only the change report is computed per grapheme, so in rare cases where normalization merges characters across a grapheme boundary the report can miss that change.',
    'The report lists only the first 100 changed graphemes; the counts cover the whole input.',
    'A browser textarea may normalize line endings, but it does not change Unicode normalization of the text you paste.',
  ],
};
