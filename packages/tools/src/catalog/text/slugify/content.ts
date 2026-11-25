import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A slug is a readable identifier often used as one segment of a URL, such as creme-brulee-42. This tool extracts words and joins them with one chosen separator.\n\nASCII mode removes common Latin accents and maps selected Latin letters such as ß → ss, æ → ae and ł → l. Unicode mode keeps letters from other scripts and their combining marks, with optional Latin-accent removal.\n\nA slug is not an entire URL, an encoded URL component or a unique database identifier. It is a text transformation; different titles can produce the same result.',
      title: 'What is a slug?',
    },
    {
      content: [
        'Create readable article, product or documentation paths.',
        'Generate consistent names from titles with spaces, punctuation and accents.',
        'Keep non-Latin text readable when your routing system supports Unicode paths.',
        'Choose hyphens, underscores or dots to match an existing naming convention.',
      ],
      title: 'When to slugify text',
    },
  ],
  examples: [
    'Crème brûlée #42 → creme-brulee-42 in ASCII mode.',
    'Straße Æsir Łódź → strasse-aesir-lodz in ASCII mode.',
    'Příliš žluťoučký → příliš-žluťoučký in Unicode mode with accents retained.',
    '你好 世界 → 你好-世界 in Unicode mode.',
    'one---two / three → one-two-three; separator runs and edge punctuation are normalized.',
  ],
  faq: [
    {
      answer:
        'ASCII mode keeps only A–Z, a–z and 0–9 after removing Latin accents; it does not transliterate other scripts. Choose Unicode to keep them, for example Привет мир → привет-мир.',
      question: 'Why does ASCII mode reject Chinese, Cyrillic or Greek text?',
    },
    {
      answer:
        'Apostrophes are punctuation, so they split words: Don’t stop → don-t-stop. Remove apostrophes first with Find & Replace if you want dont-stop.',
      question: 'What happens to apostrophes, as in don’t?',
    },
    {
      answer:
        'No. Slugify is a plain text transformation, so Hello World! and hello-world both become hello-world. Check new slugs against your existing paths and add your own suffix when they collide.',
      question: 'Will two different titles always get different slugs?',
    },
    {
      answer:
        'No, the whole title is converted without truncation. The summary shows the slug’s code points and UTF-8 bytes so you can compare it with your system’s limit and shorten it yourself.',
      question: 'Does Slugify shorten long titles?',
    },
    {
      answer:
        'ASCII mode maps ß → ss, æ → ae, œ → oe, ø → o, ł → l, đ and ð → d, ħ → h, ŧ → t, dotless ı → i and þ → th; other letters without a removable accent, such as ŋ, become word separators. Unicode mode keeps them as letters, so Straße → straße.',
      question: 'How are letters like ß, æ and ł handled?',
    },
  ],
  help: 'Paste a title or name, or apply a complete sample.\n\nChoose ASCII for a restricted Latin/digit slug, or Unicode to retain other scripts. ASCII does not transliterate Chinese, Cyrillic or every Latin letter.\n\nChoose the separator, lowercase handling and whether numbers should remain. In Unicode mode, uncheck Remove Latin accents to retain accented letters.\n\nRun Slugify. If no supported letters or numbers remain, it reports an error instead of returning an unusable empty slug.\n\nCopy or Download slug.txt. Use URL Encode if a receiving system requires percent-encoded path text, and check uniqueness before storing the slug.',
  notes: [
    'Runs locally and offline. Source text is never uploaded or executed.',
    'Supports 100,000 UTF-16 input units. Unpaired Unicode surrogates are rejected so the displayed and saved UTF-8 text agree.',
    'The only separators are -, _ and .; whitespace, slash, query delimiters and arbitrary regex syntax are rejected. Separator runs are always collapsed and leading/trailing separators are removed.',
    'ASCII mode supports A–Z, a–z and 0–9. Its additional letter mapping is limited to ß/ẞ, æ/Æ, œ/Œ, ø/Ø, ł/Ł, đ/Đ, ð/Ð, ħ/Ħ, ŧ/Ŧ, dotless ı and þ/Þ; other unsupported characters split words rather than being guessed.',
    'Unicode mode uses letters, number characters and attached combining marks. Punctuation, emoji, joiners and whitespace separate words. Turning off numbers removes all Unicode number categories.',
    'Text is normalized to NFC. Accent removal decomposes only Latin letters with marks; it does not remove vowel signs from other scripts or perform full-language transliteration.',
    'Lowercase uses default Unicode rules, not a device-dependent locale. No length truncation, uniqueness suffix, reserved-word check or routing policy is applied.',
    'The saved file contains the complete plain slug with no added newline.',
  ],
};
