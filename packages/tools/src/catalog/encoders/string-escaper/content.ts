import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'String literals reserve some characters: the quote that ends the literal, the backslash that starts an escape, and control characters such as newlines. Escaping rewrites them so the text can sit safely inside source code, a query, a document or a command line.',
        'Each language has its own rules, so text escaped for JSON is not always valid for SQL or a shell. Everything runs locally in your browser or editor.',
      ],
      title: 'What is string escaping?',
    },
    {
      content: [
        'JSON, JavaScript and Java use backslash escapes: \\" \\\\ \\n \\t and \\uXXXX for control characters. JavaScript also escapes the single quote. SQL doubles the single quote. Regex puts a backslash before special characters. XML uses entities such as &amp; and &lt;.',
        "A CSV field is wrapped in double quotes when it contains a comma, a quote or a line break, and inner quotes are doubled. POSIX shell escaping wraps the text in single quotes and rewrites each inner single quote as '\\''.",
      ],
      title: 'Rules per language',
    },
  ],
  examples: [
    'JSON: He said "hi" → He said \\"hi\\"',
    "JavaScript: it's → it\\'s",
    "SQL: O'Reilly → O''Reilly",
    'Regex: a.b*c? → a\\.b\\*c\\?',
    'XML: <a & b> → &lt;a &amp; b&gt;',
    "Shell: it's → 'it'\\''s'",
  ],
  faq: [
    {
      answer:
        'Switch Mode to Unescape and keep the same language. The tool removes surrounding quotes when both ends have one, then decodes the escapes and reports the position of the first invalid one.',
      question: 'How do I reverse an escaped string?',
    },
    {
      answer:
        'Only for JSON, JavaScript, Java and SQL, where the literal is normally wrapped in quotes. Turn on Wrap in quotes in Escape mode. Regex, XML, CSV and shell output is left as is.',
      question: 'When can the result be wrapped in quotes?',
    },
    {
      answer:
        'No. Non-ASCII letters such as accents and emoji stay as they are. Only quotes, backslashes, control characters and the line separators U+2028 and U+2029 are rewritten.',
      question: 'Does it escape non-ASCII characters?',
    },
    {
      answer:
        'Unescape does not expand variables or command substitution. Input with an unquoted dollar sign or backtick, or with several words, is rejected instead of guessing what a shell would do.',
      question: 'Why is a shell string with $ rejected?',
    },
  ],
  help: 'Pick the target language, choose Escape or Unescape and paste your text.\n\nIn Escape mode the result can be used inside a literal of that language. For JSON, JavaScript, Java and SQL you can also wrap it in quotes.\n\nIn Unescape mode the tool reverses the escaping and points to the first problem, for example Invalid escape \\q at position 5.\n\nThe summary shows the direction, the language and the number of input characters.',
  notes: [
    'Input is limited to 1,000,000 characters.',
    'JSON, JavaScript and Java share the same core escapes; JavaScript adds \\v, \\0, \\xHH and \\u{...}, and Java adds \\s on input.',
    'Legacy octal escapes such as \\012 are rejected on unescape.',
    'Shell unescape reads one word made of single quotes, double quotes and backslash escapes.',
    "SQL unescape reads text whose quotes are all doubled as escaped text and keeps the outer pair, so that Escape output always reverses: '' becomes ' and '''' becomes ''. Surrounding quotes are removed only when the text would otherwise have a lone quote.",
    'A single newline at the end of the input does not stop surrounding quotes from being removed.',
  ],
};
