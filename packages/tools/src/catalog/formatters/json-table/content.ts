import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A JSON table aligns an array of objects into rows and columns. Columns are the union of top-level keys, in the order they first appear; each object keeps its original row position.\n\nCells display exact JSON text. Strings keep their quotes and escapes, numbers keep their digits, and nested objects or arrays remain compact JSON rather than becoming [object Object].\n\nMissing means that the object does not contain that key. It is distinct from null, an empty string, false, zero, an empty array and an empty object.',
      title: 'What is a JSON table?',
    },
    {
      content: [
        'Compare records from an API response, fixture or exported dataset side by side.',
        'Find sparse fields, mixed value types and exact identifiers that an ordinary spreadsheet may round.',
        'Create a Markdown table for documentation without manually escaping pipes, markup or nested values.',
        'Use JSON Query first when the array is nested inside a response object.',
      ],
      title: 'When to use JSON Table',
    },
  ],
  examples: [
    '[{"a":null},{"b":""}] → row 1 shows null and Missing; row 2 shows Missing and "".',
    '[{"id":9007199254740993}] → an id cell with every digit, 9007199254740993.',
    '[{"tags":["dev"],"settings":{}}] → cells ["dev"] and {}, not [object Object].',
    '[{"a":1},{"a":2,"b":3}] → columns a and b; row 1 shows Missing under b.',
    '[] → no rows; [{},{}] → two rows and no data columns.',
  ],
  faq: [
    {
      answer:
        'The table is built from an array of objects at the top level. If your records sit inside a response such as {"items":[…]}, extract them with JSON Query, for example $.items, and paste the result.',
      question: 'Why does JSON Table say it needs a root array?',
    },
    {
      answer:
        'Cells show the exact JSON text, so the string "1" and the number 1, or "null" and null, stay distinguishable. The quotes and escape sequences are part of that text.',
      question: 'Why are strings shown with quotes in the table?',
    },
    {
      answer:
        'JSON Table exports Markdown only, as json-table.md. To get a CSV or TSV file from the same array, use the JSON ↔ CSV Converter.',
      question: 'Can I export the table as CSV?',
    },
    {
      answer:
        'No. Columns come only from top-level keys, and a nested object or array stays compact JSON in one cell, such as {"theme":"dark"}. Extract a nested array with JSON Query to view it as its own table.',
      question: 'Are nested objects flattened into columns?',
    },
    {
      answer:
        'Up to 2,000 rows and 100 columns, but the whole document is also limited to 5,000 JSON values, so rows with many fields reach that limit sooner. Larger input is rejected, not truncated.',
      question: 'How many rows can JSON Table handle?',
    },
  ],
  help: 'Paste a strict JSON array of objects, or apply a sample. Mixed arrays, scalars and duplicate top-level keys within a row are rejected with an explanation.\n\nRun JSON Table. Table preview displays row numbers and JSON-valued cells; horizontal scrolling stays inside the table.\n\nSearch rows with a case-insensitive literal substring of their original JSON cell text. Search includes rows not yet displayed; Show more reveals another 100 matching rows.\n\nChoose Markdown to inspect the export source. Headers use quoted JSON key names so empty or unusual keys remain clear.\n\nCopy or Download json-table.md always exports every row and column, regardless of the preview search or visible row count.',
  notes: [
    'Runs locally and offline. Preview values render as text, never HTML, scripts or links.',
    'Numbers and string escapes are preserved. Strings remain quoted to distinguish "1" from 1 and "null" from null.',
    'Nested values stay in one compact cell; they are not flattened into extra columns. Duplicate members inside a nested cell are retained.',
    'Duplicate decoded keys within a row are ambiguous and rejected, even when one spelling uses Unicode escapes. Prototype names are ordinary data keys.',
    'Supports 1,000,000 input characters, 5,000 JSON values, 128 nested containers, 2,000 rows, 100 columns and 100,000 cells. Path/label text and Markdown output each have an 8,000,000-character limit; oversized input is rejected, not truncated.',
    'Markdown uses pipe-table syntax, numeric HTML entities for markup-sensitive characters and a generated row-number column. Use a Markdown renderer supporting tables and entities. It is a readable report, not a JSON round-trip format.',
    'Search is literal over cell JSON text, including source escapes. It does not search decoded strings or column headings, sort rows or modify the export.',
  ],
};
