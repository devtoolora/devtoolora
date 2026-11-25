import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Text statistics describes the text you provide without rewriting it. A visible character is a grapheme cluster: an accented letter or joined emoji can contain several Unicode code points.\n\nJavaScript string length counts UTF-16 units, not visible characters. UTF-8 bytes measure the encoded text, not the size of an uploaded file or a compressed network payload.\n\nWords are word-like segments from Intl.Segmenter in the selected language. This handles more than splitting on spaces, but it is not a dictionary, tokenizer for a programming language or a universal linguistic definition.',
      title: 'What are text statistics?',
    },
    {
      content: [
        'Check the length and encoding size of a message, title or selected code.',
        'Compare visible text with JavaScript length when accents or emoji are involved.',
        'Count words and lines in documentation before publishing.',
        'Estimate reading duration using an explicit words-per-minute assumption.',
      ],
      title: 'When to measure text',
    },
  ],
  examples: [
    'é (U+00E9) → 1 grapheme, 1 code point, 2 UTF-8 bytes; e + U+0301 → 1 grapheme, 2 code points, 3 UTF-8 bytes.',
    '😀 → 1 grapheme, 1 code point, 2 UTF-16 units and 4 UTF-8 bytes.',
    '👨‍👩‍👧‍👦 → 1 grapheme, 7 code points, 11 UTF-16 units and 25 UTF-8 bytes.',
    'one + CRLF + two → 2 lines; CRLF counts as one line break.',
    '200 words at 200 words/minute → 60 seconds; empty text → 0 words and 0 seconds.',
  ],
  faq: [
    {
      answer:
        'JavaScript length counts UTF-16 units, while visible characters are grapheme clusters. The family emoji 👨‍👩‍👧‍👦 is 1 grapheme but 7 code points, 11 UTF-16 units and 25 UTF-8 bytes; the report shows all four counts.',
      question: 'Why does the character count differ from JavaScript’s string length?',
    },
    {
      answer:
        'Use the unit your destination enforces: graphemes for what readers see as characters, UTF-16 units for JavaScript string length, code points for systems that count Unicode characters, and UTF-8 bytes for byte-limited fields.',
      question: 'Which count should I use for a character limit?',
    },
    {
      answer:
        'Words come from Intl.Segmenter word segmentation, so text without spaces is still split into words: 你好世界 counts as 2 words. Choose Chinese, Japanese or Thai as Word language for those texts.',
      question: 'How are words counted in Chinese, Japanese or Thai text?',
    },
    {
      answer:
        'Yes. Numbers are word-like segments, so “12345 items at 99.9% accuracy” counts 5 words; the % sign is not a word. Digits are also counted separately as Unicode decimal digit code points.',
      question: 'Are numbers counted as words?',
    },
    {
      answer:
        'It is words × 60 ÷ your reading speed, rounded up to whole seconds; minutes are rounded up separately. For example, 201 words at 200 words/minute gives 61 seconds and 2 minutes.',
      question: 'How is the reading time calculated?',
    },
  ],
  help: 'Paste or select text, or apply a sample. Empty input is valid.\n\nChoose the word language and reading-speed assumption.\n\nChoose a readable report for inspection or JSON for structured export.\n\nRun Text Statistics and compare graphemes, code points, UTF-16 units and bytes instead of treating them as interchangeable.\n\nCopy the result or Download text-statistics.txt / text-statistics.json. The report contains counts, not a copy of your source text.',
  notes: [
    'Runs locally; input is not uploaded, executed, normalized or trimmed.',
    'Supports at most 100,000 UTF-16 units. Invalid Unicode surrogates are rejected rather than silently converted during UTF-8 encoding.',
    'Graphemes include spaces and line breaks, not just printed glyphs. Unicode segmentation comes from the runtime’s Intl.Segmenter; Unicode/ICU versions can produce different word or emoji boundaries across runtime versions.',
    'The JSON characters field counts Unicode code points for compatibility. graphemes counts perceived characters and utf16Units counts JavaScript string units.',
    'Lines split on CRLF, LF, CR and Unicode line/paragraph separators. Empty input has zero lines; a trailing line break adds an empty line. Non-blank lines contain something other than JavaScript whitespace.',
    'Digits are Unicode decimal digits, not only ASCII 0–9. Letters count Unicode letter code points; symbols count punctuation and symbol code points. Combining marks, joiners and other controls are not symbols. These categories are not a complete character partition.',
    'Reading time uses counted words and your selected speed, rounded upward separately to seconds and whole minutes. Zero words gives zero. The estimate is not calibrated to a language, reading difficulty or a particular person.',
    'UTF-8 size excludes a byte-order mark and extra file newline. Browser textareas may normalize pasted CRLF to LF before counting; only the text received by the runner is measured.',
  ],
};
