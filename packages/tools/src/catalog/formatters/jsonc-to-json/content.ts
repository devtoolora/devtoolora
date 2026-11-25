import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'JSONC is JSON with // and /* */ comments and trailing commas, as used by tsconfig.json and VS Code settings. The converter removes comments and trailing commas outside strings and formats the result as strict JSON.',
      title: 'What does JSONC to JSON do?',
    },
    {
      content:
        'JSON5 mode also accepts single-quoted strings, unquoted keys, hexadecimal numbers, leading or trailing decimal points, + signs and line continuations in strings. Each is rewritten to its strict JSON form.',
      title: 'What does JSON5 mode add?',
    },
  ],
  examples: [
    '{ "a": 1, // note\n} → {"a": 1} formatted, with 1 comment removed.',
    '[1, 2,] → [1, 2] without the trailing comma.',
    '{a:\'x\', b:0x1F, c:.5} in JSON5 mode → {"a": "x", "b": 31, "c": 0.5}.',
    '{"url": "http://x"} → the // inside the string is kept.',
  ],
  faq: [
    {
      answer:
        'No. Comments have no place in strict JSON, so they are removed. The summary says how many were removed.',
      question: 'Are comments kept?',
    },
    {
      answer:
        'JSON has no Infinity or NaN, so these values are rejected with an error. Replace them with null or a string first.',
      question: 'What happens to Infinity and NaN?',
    },
    {
      answer:
        'Yes. Numbers are copied as written, so 12345678901234567890123 is not rounded. Hexadecimal numbers are converted exactly.',
      question: 'Are big numbers kept exact?',
    },
    {
      answer:
        'Only in JSON5 mode. JSONC mode accepts double-quoted strings only and reports the line and column of a single quote.',
      question: 'Can I use single-quoted strings?',
    },
    {
      answer:
        'Errors name the line and column of an unterminated string or comment, or of the first invalid JSON token.',
      question: 'Where is the error in my input?',
    },
  ],
  help: 'Paste JSONC or JSON5, or choose a sample.\n\nChoose JSONC for comments and trailing commas, or JSON5 for the full JSON5 syntax.\n\nPick 2 spaces, 4 spaces or tabs.\n\nCopy the result or save it as a JSON file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 input characters, 2,500,000 values and 128 nesting levels.',
    'Octal escapes such as \\1 are rejected, as JSON5 requires.',
    'Duplicate keys are kept as written; the summary counts them.',
    'Infinity, -Infinity and NaN are rejected because JSON has no equivalent.',
  ],
};
