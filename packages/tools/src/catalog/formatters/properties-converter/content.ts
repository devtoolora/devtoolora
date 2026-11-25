import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Each logical line is a key and a value. The key ends at the first unescaped =, : or whitespace; one separator and the whitespace around it are skipped. A line ending in an odd number of backslashes continues on the next line, whose leading whitespace is dropped. Lines starting with # or ! are comments. \\uXXXX, \\t, \\n, \\r and \\f are escapes, and a backslash before any other character keeps that character.',
      title: 'How is a .properties file read?',
    },
    {
      content:
        'JSON and YAML objects are flattened into dotted keys, so {"db": {"port": 5432}} becomes db.port=5432. Numbers and booleans are written as their JSON text. Arrays and null have no .properties form and are errors that name the key. Keys escape spaces, =, :, # and !; values escape a leading space, backslashes and line breaks, so the output reads back unchanged.',
      title: 'What does conversion to .properties write?',
    },
  ],
  examples: [
    'db.host=x\ndb.port=5432 → {"db": {"host": "x", "port": "5432"}}.',
    'With Nested keys off: db.host=x → {"db.host": "x"}.',
    'title = Caf\\u00e9 → {"title": "Café"}.',
    '{"a": {"b": true}, "c": " x"} → a.b=true and c=\\ x.',
  ],
  faq: [
    {
      answer:
        'The last one wins, as in java.util.Properties. Earlier values for the same key are dropped without an error.',
      question: 'What happens to a repeated key?',
    },
    {
      answer:
        'With Nested keys on, a=1 and a.b=2 cannot both fit: a would have to be a string and an object. Turn off Nested keys to keep every key flat, as written.',
      question: 'Why is my key "both a value and a parent"?',
    },
    {
      answer:
        'No. .properties values are text, so Properties → JSON always gives strings. Numbers and booleans from JSON or YAML are written as text and read back as strings.',
      question: 'Are numbers and booleans kept?',
    },
    {
      answer:
        'Java 9 and later read .properties files as UTF-8, older versions as ISO-8859-1. Turn on Escape non-ASCII to write every other character as \\uXXXX, which every version reads.',
      question: 'When should I escape non-ASCII characters?',
    },
    {
      answer:
        'Arrays, null and keys that would be written twice after flattening, such as "a.b" next to {"a": {"b": …}}, are errors. Empty objects write nothing.',
      question: 'What cannot be converted to .properties?',
    },
  ],
  help: 'Choose a direction: Properties → JSON, Properties → YAML, JSON → Properties or YAML → Properties.\n\nPaste the input, or pick a sample.\n\nUse Nested keys to switch between nested objects and flat dotted keys, and Escape non-ASCII for \\uXXXX output.\n\nCopy the result or save it as a .json, .yaml or .properties file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters and 100,000 lines for .properties input and output, 100 levels for nested keys, and 5,000,000 characters for JSON and YAML input.',
    'YAML input and output also go through the shared YAML converter, which allows 100 nesting levels and 1,000,000 values.',
    'A repeated key keeps its last value, as in java.util.Properties. In JSON input the summary also names the key and line.',
    'A UTF-8 byte order mark at the start is ignored, and CRLF line endings are accepted.',
  ],
};
