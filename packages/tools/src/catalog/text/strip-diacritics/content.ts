import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Some accented characters can be canonically decomposed into a base letter and combining marks. Removing selected marks can produce a simpler spelling, such as č → c or é → e.',
        'This is not general transliteration: Ł, ø, ß, æ and œ do not become ASCII just because accents are removed. The result reports remaining non-ASCII code points instead of claiming every string became ASCII.',
        'The default targets combining diacritics following Latin letters. Broader scopes can change meaningful marks in other scripts or emoji presentation and must be chosen deliberately.',
      ],
      title: 'What is diacritic stripping?',
    },
    {
      content: [
        'Create an explicitly accent-insensitive copy of Latin text for comparison or export.',
        'Inspect the difference between composed and decomposed accents.',
        'Remove combining diacritics across scripts only when loss of those distinctions is intentional.',
        'Audit which text changed while retaining the original spelling in a separate report.',
      ],
      title: 'When to use Strip Diacritics',
    },
  ],
  examples: [
    'Latin accents: Příliš žluťoučký kůň → Prilis zlutoucky kun.',
    'Composed café or decomposed cafe + U+0301 → cafe in Latin mode.',
    'Default Latin scope: Café / ά / عَرَبِيّ / ♥️ → Cafe / ά / عَرَبِيّ / ♥️.',
    'Łódź Straße smør æsir → Łodz Straße smør æsir; Ł, ß, ø and æ have no decomposable accent to remove.',
    'All combining marks: é ♥️ 1️⃣ → e ♥ 1, because variation selectors and the keycap mark are Unicode marks.',
  ],
  faq: [
    {
      answer:
        'These letters have no removable accent: they are separate letters, not a base letter plus a combining mark, so Łódź Straße smør → Łodz Straße smør. Slugify’s ASCII mode maps ł, ø, ß and a few similar letters to ASCII.',
      question: 'Why don’t Ł, ø and ß become plain ASCII?',
    },
    {
      answer:
        'Yes, stacked marks are removed: Tiếng Việt → Tieng Viet. The letter đ stays đ because it is a letter of its own, so check the summary’s count of remaining non-ASCII code points.',
      question: 'Does it work with Vietnamese text?',
    },
    {
      answer:
        'Not with the default Latin accents scope, which leaves שָׁלוֹם and عَرَبِيّ unchanged. Combining diacritics removes those marks (שלום, عربي), which can change pronunciation or meaning.',
      question: 'Will it remove Arabic or Hebrew vowel marks?',
    },
    {
      answer:
        'Latin accents and Combining diacritics keep emoji intact. All combining marks also removes variation selectors and the keycap mark, so ♥️ → ♥ and 1️⃣ → 1.',
      question: 'Does it change emoji?',
    },
    {
      answer:
        'Yes. Each character is decomposed with NFD before marks are removed, so precomposed é and e followed by U+0301 both become e, and Ångström ñ ç → Angstrom n c.',
      question: 'Does it handle decomposed accents?',
    },
  ],
  help: 'Paste text or apply a sample. Empty and whitespace-only sources are valid.\n\nStart with Latin accents. Compare other-script and emoji samples before enabling Combining diacritics or All combining marks.\n\nInspect Changes and the counts: removed marks are counted after NFD decomposition, changed graphemes refer to source clusters, and remaining non-ASCII code points are counted in the actual output.\n\nChoose Result text for a plain copy-ready view. Copy, insert and save in Changes still use exact stripped text, not visual diff markup.\n\nSave stripped-text.txt, or choose JSON audit and save diacritics-report.json with original source, result, settings, counts and available comparison. Samples reset both fields.',
  notes: [
    'This is lossy accent/mark removal, not translation, Unicode-to-ASCII transliteration, language-aware spelling correction, slug generation or safe identifier normalization. Distinct names or words can collapse to the same output.',
    'Per source grapheme: canonical NFD decomposition → selected mark removal → NFC composition only when a mark was removed. Untargeted graphemes retain their original code points exactly, including decomposed Greek spelling, emoji, Hangul and ligatures.',
    'Latin scope uses a Latin Letter base and the intersection of Unicode Mark and Diacritic properties. Detached combining accents, spacing accents and mathematical symbols such as ^ are not stripped by this default.',
    'Combining diacritics still does not remove all Unicode marks. It preserves variation selectors and keycap marks but can remove linguistically important tones, Arabic vowel marks and Indic viramas. Review the output before replacing source text.',
    'All combining marks is deliberately broader and can change emoji rendering, keycap sequences, vowels, consonant clusters or musical notation. Joiners, skin-tone modifiers and other non-Mark characters are not automatically removed.',
    'Canonical decomposition is used, not compatibility decomposition. Nondecomposing letters and compatibility ligatures remain unless their selected combining marks are present. An ASCII-only result is reported only if every output code point is at most U+007F.',
    'Removed-mark counts refer to decomposed characters, not the difference between input/output code-point counts. For example, a precomposed é has one input code point, removes one decomposed mark and produces one output code point e.',
    'Unicode properties and grapheme segmentation follow the installed runtime’s Unicode data. A current Intl.Segmenter implementation is required; no UTF-16-unit splitting fallback is used.',
    'Input is limited to 100,000 UTF-16 units and output to 1,000,000. NUL and unpaired surrogates are rejected. Spaces, tabs, CR, LF, CRLF and absence of a terminal newline are retained; detached-mark deletion can leave an empty body or an empty result.',
    'Untouched samples and VS Code source drafts retain raw terminators. User-edited browser textareas normalize newlines to LF and that edited value becomes the actual source.',
    'Changes initially shows 100 aligned rows. If text, physical-line or diff-complexity budgets prevent comparison, transformation still succeeds with exact output and an explanation in the audit. TXT exports never include report counts or diff markup.',
  ],
};
