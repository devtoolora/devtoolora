import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'CSV profiling summarizes a table without changing its source. The report shows row/column counts, an inferred type, missing and distinct value counts, up to three examples and numeric or date ranges per column.\n\nType inference is a practical heuristic, not a schema guarantee. Leading-zero identifiers remain string-like; large integer ranges retain their exact digits.\n\nThe profiler uses the same quoting, separator, header and record-width checks as CSV to JSON, so the two tools agree about which records exist.',
      title: 'What is CSV profiling?',
    },
    {
      content: [
        'Check a CSV or TSV export for blank fields, unexpected text values and suspiciously low uniqueness before importing it.',
        'Inspect integer, decimal, boolean or ISO date columns and see representative values without loading a spreadsheet.',
        'Compare the inferred shape with the schema expected by your destination; then convert the same table to JSON if needed.',
      ],
      title: 'When to profile CSV',
    },
  ],
  examples: [
    'age values 37 and 40 → integer, unique 2, min 37 and max 40.',
    'An empty cell or whitespace-only value → missing; other statistics use trimmed non-empty values.',
    'id values 001 and 002 → string; leading zeros are not interpreted as integer ranges.',
    'Integer values 9007199254740993 and 9007199254740995 → exact min/max digits without Number rounding.',
    '2026-02-30 → string, not an ISO calendar date; 2024-02-29 is a valid leap-day date.',
  ],
  faq: [
    {
      answer:
        'Every non-empty value in a column must fit the type, checked in the order integer, number, boolean, date (YYYY-MM-DD) and string. A single value that does not fit, such as x in a column of decimals, makes the whole column string.',
      question: 'How does the profiler decide a column’s type?',
    },
    {
      answer:
        'Values with leading zeroes, such as 001, are treated as identifiers so the zeroes are not lost. A leading plus sign, a decimal comma or a date such as 01/02/2024 also makes a column string.',
      question: 'Why is my ID or number column shown as string?',
    },
    {
      answer:
        'No. Choose Comma, Semicolon or Tab to match the file. A semicolon file read with Comma comes out as one joined column, or as a quoting error when a quoted cell contains the separator.',
      question: 'Does it detect the separator automatically?',
    },
    {
      answer:
        'No. Only true and false, in any letter case, count as boolean. Columns of 1 and 0 are profiled as integer, and yes/no values as string.',
      question: 'Are yes/no or 1/0 columns detected as boolean?',
    },
    {
      answer:
        'Profiling stops with an error that names the record and the expected width, such as “CSV record 2 has 1 cells; expected 2”. Missing cells are never filled in and extra cells are never dropped.',
      question: 'What happens when a row has the wrong number of cells?',
    },
    {
      answer:
        'No. Parsing and profiling run locally in the app, and the report is built from the pasted text without any network request.',
      question: 'Is my CSV uploaded anywhere?',
    },
  ],
  help: 'Paste a header row and at least one data record, or choose a sample. Match the source separator with Comma, Semicolon or Tab.\n\nChoose whether truly blank lines should be skipped. Quoted empty cells, separator-only records and whitespace cells are still counted.\n\nRun and inspect each column section. Missing counts and uniqueness use trimmed cells; quoted separators, line breaks and raw input are not modified.\n\nCopy the report or save csv-profile.md. Use CSV to JSON for a string-preserving conversion; use a destination-specific schema for actual validation.',
  notes: [
    'Processing is local; the profiler does not execute cells or contact a database, spreadsheet or server.',
    'Headers must be named and unique, and every data record must match their width. Malformed quoting produces a line/column error; no cells are silently filled or discarded.',
    'A leading BOM and LF, CRLF or CR record endings are supported. Newlines inside quoted cells stay in the value and appear escaped in report samples.',
    'Missing and distinct counts ignore leading/trailing cell whitespace; an all-blank column is empty. Only up to three distinct non-empty samples are shown, but all records contribute to the statistics.',
    'Inferred types are integer, number, boolean, date, string or empty. Leading-zero identifiers stay string-like; booleans accept true/false case-insensitively; dates require a real YYYY-MM-DD calendar date.',
    'Integer ranges are exact, including values outside JavaScript safe-integer bounds. Decimal ranges use JavaScript numbers and are approximate; the report is not suitable for financial arithmetic.',
    'Blank lines contain no characters between record endings. Skipping them does not skip explicit empty cells or whitespace-only values.',
    'The limit is 5,000,000 input characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header. The report is never silently truncated.',
  ],
};
