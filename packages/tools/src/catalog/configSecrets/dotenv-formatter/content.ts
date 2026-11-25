import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A dotenv file stores named string values as KEY=value lines. It is configuration text, not a JSON object or executable shell script.',
        'Formatting normalizes assignment spacing while preserving names, values, quotes, comments and source order. It does not sort, deduplicate or resolve references.',
        'Malformed syntax or duplicate names stop formatting instead of deleting invalid lines.',
      ],
      title: 'What is dotenv formatting?',
    },
    {
      content: [
        'Normalize a development configuration before reviewing its diff.',
        'Keep quoted spaces and literal variable references intact.',
        'Use Validator for diagnostics and Secret Redactor before preparing a shareable copy.',
      ],
      title: 'When to use .env Formatter',
    },
  ],
  examples: [
    ' export PORT = 3000 → export PORT=3000.',
    'LABEL="  demo  " → LABEL="  demo  ", with its quoted spaces kept.',
    'URL = ${BASE_URL}/v1 → URL=${BASE_URL}/v1, a literal reference.',
    'EMPTY = with no value → EMPTY=, an empty string.',
    'PORT=3000# note → PORT=3000 # note.',
    'PORT=3000 then PORT=4000 → an error naming the duplicate; no last-value-wins rewrite.',
  ],
  faq: [
    {
      answer:
        'No. Variables, comments and blank lines keep their original order and grouping. Only whitespace around names, = signs and inline comments is normalized, and an export prefix is kept.',
      question: 'Does the formatter sort variables alphabetically?',
    },
    {
      answer:
        'An unquoted # starts a comment, even without a space before it, so URL=https://example.com/#top becomes URL=https://example.com/ # top. sh and python-dotenv read that value differently, so the summary warns about each such #. Wrap the value in quotes to keep a literal #.',
      question: 'Why did the part of my URL after # turn into a comment?',
    },
    {
      answer:
        'No. References such as ${BASE_URL}, backslash escapes and shell syntax are written back exactly as typed; nothing is looked up or executed.',
      question: 'Are ${VAR} references expanded?',
    },
    {
      answer:
        'No. Each assignment must fit on one line. A quoted value that continues onto the next line is reported as an unterminated quote, and nothing is formatted until it is fixed.',
      question: 'Does it support multiline values?',
    },
    {
      answer:
        'Formatting runs locally without sending the file anywhere, but the output keeps every value, including secrets. Run Secret Redactor on the result before sharing it.',
      question: 'Is it safe to format a .env file that contains real secrets?',
    },
  ],
  help: 'Paste configuration or select a sample.\n\nRun formatting and review the output before replacing your source.\n\nUse Copy or download formatted.env for the exact normalized text.\n\nFormatting preserves secrets. Do not publish this output without a separate review.',
  notes: [
    'This parser supports single-line KEY=value assignments, quotes, comments and optional export. Multiline values and shell execution are unsupported.',
    'Names must begin with an ASCII letter or underscore and contain only ASCII letters, digits and underscores. Names are case-sensitive.',
    'Unquoted # starts a comment, even without a space. Quote literal hashes such as URL fragments.',
    'Variable references such as ${BASE_URL} remain literal; no environment lookup, interpolation or escape decoding occurs.',
    'CRLF and CR become LF; an initial BOM is removed. Order, grouping and terminal newline are retained unless comments are explicitly removed.',
    'Input is limited to 1,048,576 UTF-16 characters. Duplicate names are reported as issues, not silently overridden.',
    'Formatter is not a redactor: secrets remain in the output, clipboard and downloaded file.',
  ],
};
