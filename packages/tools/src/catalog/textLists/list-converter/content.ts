import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A list is a sequence of short values written with some separator: one per line, comma separated, a JSON array or a SQL IN clause. Converting between them is a recurring chore when moving ids, emails or names between spreadsheets, logs, queries and code.',
        'This tool splits the input into items, optionally trims, drops empty items and removes duplicates, then joins the items in the output format you choose. Everything runs locally in your browser or editor.',
      ],
      title: 'What is a list converter?',
    },
    {
      content: [
        'Turn a column of ids copied from a spreadsheet into a SQL IN (...) list.',
        'Turn a comma separated string into a JSON array, or a JSON array into one value per line.',
        'Clean up a pasted list: trim whitespace, drop blank rows and remove duplicates.',
        'Join items with a custom separator such as " | " or "; " for config values and documentation.',
      ],
      title: 'When to use List Converter',
    },
  ],
  examples: [
    'Lines to SQL: "a", "b", "b" on separate lines with Remove duplicates on → (\'a\', \'b\').',
    'Comma to JSON: red, green, blue → ["red","green","blue"].',
    'JSON to quoted lines: ["one","two"] with Double quotes → "one" and "two" on separate lines.',
    'Tab to comma: id<TAB>name<TAB>email → id, name, email.',
    'Custom separator: one / two / three on separate lines with " | " → one | two | three.',
  ],
  faq: [
    {
      answer:
        'JSON output always uses JSON string rules, and SQL output always uses single quotes with doubled apostrophes. The Quote items option only applies to lines, comma and custom output.',
      question: 'Why does the quote option not change JSON or SQL output?',
    },
    {
      answer:
        "Choose SQL IN list. Every item is wrapped in single quotes and any apostrophe inside is doubled, so O'Brien becomes 'O''Brien'. Numeric ids are still quoted; remove the quotes by hand if your column is numeric.",
      question: 'How do I build a SQL IN list with apostrophes?',
    },
    {
      answer:
        'Auto treats text starting with [ and parsing as a JSON array as JSON. Otherwise it picks the first separator found in this order: newline, comma, semicolon, tab, space. A single newline at the very end does not count. Text with none of them is a single item. Set the input format explicitly when this guess is wrong.',
      question: 'What does auto-detect do?',
    },
    {
      answer:
        'Input is limited to 100,000 UTF-16 units and 10,000 items. Larger input is rejected with a message naming the limit, so the page never freezes on huge pastes.',
      question: 'Is there a size limit?',
    },
  ],
  help: 'Paste a list or choose a sample, then pick the input and output formats.\n\nAuto-detect works for most pastes. If your values contain commas inside lines, set the input format to Lines so only line breaks split items.\n\nTrim removes surrounding whitespace from every item. Drop empty items removes blank entries such as the one after a trailing newline. Remove duplicates keeps the first occurrence and compares trimmed text exactly, so letter case matters.\n\nQuote items wraps each item in single or double quotes for lines, comma and custom output. SQL output always uses single quotes, and JSON output follows JSON rules.\n\nCopy the result, insert it into the editor, or save list.txt or list.json.',
  notes: [
    'Input is limited to 100,000 UTF-16 units and 10,000 items. The limits apply before deduplication.',
    'A JSON array may contain strings, numbers, booleans and null only; nested arrays and objects are rejected. Items are converted to their text form, so null becomes the word null. A number a double cannot hold, such as 12345678901234567890, keeps its exact digits.',
    'Duplicates are compared after trimming and are case-sensitive. The first occurrence is kept and the original order is preserved.',
    'Double quotes are escaped with a backslash and single quotes are doubled; other characters are left unchanged. Browser textareas normalize line endings to LF.',
    'The custom separator must be between 1 and 32 UTF-16 units and is used exactly as typed, including spaces.',
  ],
};
