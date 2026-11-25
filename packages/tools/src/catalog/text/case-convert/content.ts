import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Case conversion changes letter casing. Display modes preserve punctuation, spaces and line endings; identifier modes split text into words and rebuild a compact naming convention.\n\ncamelCase, PascalCase, snake_case, kebab-case and CONSTANT_CASE use Unicode letters and numbers, and recognize acronym endings such as JSONParser → JSON + Parser.\n\nUpper, lower, title, sentence and alternating modes operate on the original text. They do not apply identifier accent removal or collapse the layout.',
      title: 'What is case conversion?',
    },
    {
      content: [
        'Rename variables, keys and CSS-style names using a consistent convention.',
        'Convert display text to upper or lower case without destroying punctuation or line breaks.',
        'Inspect mechanical title, sentence or alternating letter casing.',
        'Choose Turkish, Azerbaijani or Lithuanian rules when default Unicode casing is not appropriate.',
      ],
      title: 'When to convert text case',
    },
  ],
  examples: [
    'parseJSONPayloadResponse → parse_json_payload_response in snake_case.',
    'XMLHttpRequest → xml-http-request in kebab-case.',
    'déjà vu 123!!! → dejaVu123 with identifier accent removal.',
    'Hello, WORLD!\nNext LINE. → hello, world!\nnext line. in lower case.',
    'İSTANBUL I → istanbul ı with Turkish lower-case rules.',
  ],
  faq: [
    {
      answer:
        'A run of capitals followed by a capital and a lowercase letter splits before that last capital, so XMLHttpRequest → xml-http-request and JSONParser → json_parser. The rule is mechanical, not dictionary-based: iOSApp → i-os-app.',
      question: 'How are acronyms like XMLHttpRequest split?',
    },
    {
      answer:
        'Title Case capitalizes the first letter of every word and lowercases the rest, so the lord OF the rings NASA → The Lord Of The Rings Nasa. It does not apply AP, Chicago or other style-guide rules for short words or acronyms.',
      question: 'Why does Title Case capitalize words like “of” and “the”?',
    },
    {
      answer:
        'Default Unicode rules lowercase İ (U+0130) to i followed by a combining dot above. Choose Turkish or Azerbaijani case rules to get İSTANBUL I → istanbul ı instead.',
      question: 'Why does lower case turn İ into i with an extra dot?',
    },
    {
      answer:
        'Yes. Digits stay inside their word, so 3d model → 3dModel and version2Value → version2_value. Leading digits and reserved words are not checked, so rename the result if your language does not allow it.',
      question: 'Can a camelCase result start with a digit?',
    },
    {
      answer:
        'No. It applies only to camelCase, PascalCase, snake_case, kebab-case and CONSTANT_CASE, where Příliš žluťoučký → prilisZlutoucky. UPPER CASE, lower case, Title Case, Sentence case and alternating case always keep accents.',
      question: 'Does Remove Latin accents affect UPPER CASE or Title Case?',
    },
  ],
  help: 'Paste text or an identifier, or apply a complete sample.\n\nChoose a target case. Identifier modes split camel/acronym boundaries, replace punctuation with word boundaries and join tokens; display modes retain the original layout.\n\nSelect case rules for locale-sensitive letters. In identifier modes, uncheck Remove Latin accents to retain accented Latin letters.\n\nRun Case Converter, then inspect the output. No-word input produces an empty identifier, not an invented name; display modes retain punctuation-only text.\n\nCopy or Download converted-case.txt. Check your language or system’s identifier rules: leading digits, reserved words and duplicate names are not validated.',
  notes: [
    'Runs locally and offline; no regex input, eval or remote processing is used.',
    'Supports 100,000 UTF-16 input units. Unpaired surrogates and unknown target cases or locales are rejected rather than silently falling back.',
    'Identifier modes normalize to NFC and optionally strip marks from Latin letters only. Other scripts and their combining marks remain supported. Numbers stay in word parts; acronym splitting is mechanical, not dictionary based.',
    'Display modes preserve whitespace, punctuation, numbers and line endings received by the runner; browser textareas may normalize pasted CRLF to LF. Title case capitalizes each letter/number word, including hyphen-separated words, while apostrophes remain inside a word; it is not an editorial style guide.',
    'Sentence case lowercases the text and capitalizes the first letter at the start, after . ! ? followed by whitespace, and on a new line. It does not recognize abbreviations, names or language-specific sentence grammar.',
    'Alternating case starts lowercase and advances only on cased Unicode code points. Spaces, marks, emoji, uncased letters and numbers do not advance the pattern; it is not grapheme-based or linguistic casing.',
    'Case mapping can change length, such as ß → SS. Converting case is not reversible. Default Unicode rules are independent of the machine’s selected language; the named locales use JavaScript locale-aware casing.',
    'Empty input is valid. Identifier output may be empty when there are no words; the artifact still represents that exact empty result. The output file has no added newline.',
  ],
};
