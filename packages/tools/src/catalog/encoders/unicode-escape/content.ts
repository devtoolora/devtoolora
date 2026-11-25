import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Unicode assigns characters numeric code points; an escape such as \\u{2713} writes the check mark ✓ using its hexadecimal code point.\n\nJavaScript supports braced code point escapes and four-digit UTF-16 escapes; characters outside the Basic Multilingual Plane use a surrogate pair in the four-digit form.',
      title: 'What are Unicode escapes?',
    },
    {
      content: [
        'Make invisible whitespace or unfamiliar characters visible in a JavaScript-oriented test fixture.',
        'Inspect \\uXXXX or \\u{...} sequences from source code or a log without executing code.',
        'Compare Unicode code points with UTF-8 bytes using the Hex or Binary converters.',
      ],
      title: 'When to use Unicode Escape',
    },
  ],
  examples: [
    'Encode: A ✓ → \\u{41}\\u{20}\\u{2713}',
    'Decode: \\u0041\\u{2713} → A✓',
    'Emoji: \\uD83D\\uDE0A or \\u{1f60a} → 😊',
    'Decode mixed text: Price \\u20ac5 → Price €5',
  ],
  faq: [
    {
      answer:
        'Both mean 😀 in JavaScript. The braced form writes the code point directly, while the four-digit form needs two UTF-16 code units, a surrogate pair, for any character above U+FFFF. This tool decodes both and always encodes with braces.',
      question: 'What is the difference between \\u{1F600} and \\uD83D\\uDE00?',
    },
    {
      answer:
        'Not as is. JSON supports only four-digit \\uXXXX escapes, so braced output such as \\u{2713} is invalid JSON; write \\u2713 instead, and use a surrogate pair for characters above U+FFFF.',
      question: 'Can I use the output in a JSON string?',
    },
    {
      answer:
        'Encode the text. Every code point becomes its own escape, so a non-breaking space appears as \\u{a0} and a zero-width space as \\u{200b}, even though both are hard to see on screen.',
      question: 'How can I find invisible characters such as zero-width spaces?',
    },
    {
      answer:
        'Yes. \\u00E9 and \\u00e9 both decode to é, and braced escapes accept either case too. The u itself must be lowercase, so Python/C forms such as \\U000000E9 stay unchanged. Encoding always writes lowercase digits without leading zeros, such as \\u{e9}.',
      question: 'Are uppercase hex digits accepted when decoding?',
    },
  ],
  help: 'Choose Encode for literal text or Decode for a fragment containing Unicode escape sequences.\n\nFor Encode, paste the text; every code point, including spaces and newlines, becomes a lowercase hexadecimal braced escape such as \\u{a}.\n\nFor Decode, paste JavaScript \\u{...} or exactly four-digit \\uXXXX sequences, alone or mixed with ordinary text, which is copied unchanged.\n\nRun and copy the result, or use “Use result & reverse” to check the round trip.',
  notes: [
    'Braced \\u{...} output is JavaScript syntax, not JSON string syntax; use JSON tools when producing a complete JSON document.',
    'This is a fragment converter, not a JavaScript or JSON string parser; it does not interpret quotes, \\n, \\xXX or escaped backslashes.',
    'Only the JavaScript forms \\uXXXX and \\u{...}, with a lowercase u, are decoded in one pass. Python/C \\UXXXXXXXX and other or incomplete escapes remain unchanged; braced values above U+10FFFF are errors.',
    'Four-digit escapes represent UTF-16 code units; a surrogate pair produces one character, while an isolated surrogate is not a complete Unicode character.',
  ],
};
