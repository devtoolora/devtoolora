import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A CSV diff compares two tables row by row instead of line by line. With a key column such as id, rows are matched by their key, so reordering rows creates no changes. Rows only in the first CSV are removed, rows only in the second CSV are added, and matched rows with different cells are changed, with each changed cell shown before and after.\n\nWithout a key, rows are matched by their 1-based data row number, so an inserted row changes every later row.\n\nCells are matched by header name, so column order does not matter. A column only in the second CSV is an added column and a column only in the first CSV is a removed column; their cells never mark a row as changed.',
      title: 'What is a CSV diff?',
    },
    {
      content: [
        'Check what an export or a database dump changed between two runs.',
        'Review edits to a spreadsheet saved as CSV before importing it.',
        'Confirm that a migrated table kept every row and value.',
        'Find added and dropped columns after a report format changed.',
      ],
      title: 'When to compare CSV files',
    },
  ],
  examples: [
    'id,v / 1,a / 2,b vs id,v / 2,c / 3,d with key id → Removed key "1", Changed key "2": "v": "b" → "c", Added key "3".',
    'a / 1 / 2 vs a / 1 without a key → Removed row 2.',
    'id,a,b vs id,b,c → Added column "c" and Removed column "a"; only b is compared.',
    '1.0 vs 1, or a vs A → changed; values are compared exactly.',
  ],
  faq: [
    {
      answer:
        'Use a key column when rows have a stable identifier such as id or email. Rows are then matched by that value, so sorting or inserting rows does not create changes. Without a key, rows are matched by position.',
      question: 'Should I use a key column?',
    },
    {
      answer:
        'Each key value must appear once per CSV, because a duplicate would match more than one row. The error names the first duplicate and the CSV it is in. An empty key cell is a key value too.',
      question: 'Why is a duplicate key an error?',
    },
    {
      answer:
        'No. Values are compared exactly: no trimming, no case folding and no number normalization, so 1.0 and 1, or a and A, are different. Record line endings (CRLF/LF) make no difference; line breaks inside quoted values are compared exactly.',
      question: 'Are 1.0 and 1 treated as equal?',
    },
    {
      answer:
        'Yes. The separator of each CSV is detected on its own from the first 20 records, so a semicolon CSV can be compared with a comma CSV. Columns are matched by header name, not position.',
      question: 'Can the two CSVs use different separators or column orders?',
    },
    {
      answer:
        'The report lists at most 10,000 changes and 10,000,000 characters of keys, column names and values. The counts in the summary stay exact, and the summary says how many changes are shown.',
      question: 'Why are not all changes listed?',
    },
  ],
  help: 'Paste the older CSV in First CSV (before) and the newer one in Second CSV (after), or pick a sample.\n\nEnter a header name in Key column to match rows by it, or leave it empty to compare row by row.\n\nRun CSV Diff. The table lists removed and changed rows in the order of the first CSV, then added rows.\n\nCopy the text report or save it as a .txt file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header, for each CSV. The report lists at most 10,000 changes and 10,000,000 characters of keys, column names and values; counts stay exact.',
    'Values are compared exactly: no trimming, no case folding and no numeric normalization.',
    'Columns and the key column are matched by exact header name, including spaces and case. A repeated header name, including a repeated empty one, is an error that names the CSV. Only columns in both CSVs are compared.',
    'Short rows are filled with empty cells; cells beyond the header width are ignored.',
    'The separator of each CSV is detected separately, and a leading byte order mark is ignored. Record line endings (CRLF/LF) make no difference; line breaks inside quoted values are compared exactly.',
  ],
};
