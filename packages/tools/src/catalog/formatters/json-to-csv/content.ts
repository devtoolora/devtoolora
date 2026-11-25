import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'CSV stores a table as text: one record per line, cells separated by commas and double quotes around cells that contain separators, quotes or line breaks.\n\nJSON → CSV reads an array of objects, collects column names in first-seen order and leaves a blank cell for a missing or null value. Numbers keep their JSON spelling, nested objects and arrays become compact JSON text inside one cell, and an empty array gives an empty file.\n\nCSV → JSON reads the header row as object keys and creates one object per record. Every cell stays a string, including 00123, true and large integer-looking values, so no type is guessed.',
      title: 'What is JSON ↔ CSV conversion?',
    },
    {
      content: [
        'Export API records or JSON fixtures for a spreadsheet, import pipeline or readable table.',
        'Turn a spreadsheet export into JSON fixtures while keeping identifiers, notes and blank cells.',
        'Read or write semicolon-separated CSV or tab-separated TSV with the explicit Separator control.',
        'Catch damaged quoting, duplicate columns or shifted records before handing data to another tool.',
      ],
      title: 'When to convert between JSON and CSV',
    },
  ],
  examples: [
    'JSON → CSV: [{"name":"Ada","role":"admin"}] → name,role followed by Ada,admin.',
    'JSON → CSV: the string He said "yes" → "He said ""yes"""; embedded quotes are doubled.',
    'JSON → CSV: the nested value ["admin","editor"] → JSON text in one quoted cell, not two columns.',
    'JSON → CSV: [{"price":1.00,"id":9007199254740993}] → price,id followed by 1.00,9007199254740993.',
    'CSV → JSON: id,active followed by 00123,true → {"id":"00123","active":"true"}; values are not guessed.',
    'CSV → JSON: a quoted "Ada, A." stays one cell, and a comma-only record under a,b becomes {"a":"","b":""}.',
    'CSV → JSON: a header-only table → []; a duplicate column name or unequal record width → an error.',
  ],
  faq: [
    {
      answer:
        'They are written as compact JSON text in one cell, for example ["admin","editor"]; they are not flattened into extra columns. Converting that CSV back to JSON gives the cell as a string, not as an array.',
      question: 'How are nested objects and arrays converted to CSV?',
    },
    {
      answer:
        'The header is the union of all keys in the order they first appear, and a record without a key gets an empty cell in that column. No column is dropped.',
      question: 'What happens when JSON records have different keys?',
    },
    {
      answer:
        'CSV stores only text, so cells such as 42, true and 00123 stay "42", "true" and "00123" instead of being guessed. Convert types in your own code, or check column types first with CSV Profiler.',
      question: 'Why are all values strings after CSV to JSON?',
    },
    {
      answer:
        'Set Separator to Semicolon or Tab; the separator is never detected automatically. With the wrong separator, a semicolon file is read as a single column whose header is the whole first line.',
      question: 'How do I convert semicolon-separated or tab-separated files?',
    },
    {
      answer:
        'Every record must have exactly as many cells as the header row. A missing or extra separator shifts the cells, so the converter reports the record number instead of filling in or discarding values.',
      question: 'Why does CSV to JSON say a record has the wrong number of cells?',
    },
    {
      answer:
        'No. Exported CSV and TSV are UTF-8 without a byte order mark. When reading CSV, a leading BOM is accepted and removed before the header is parsed.',
      question: 'Does the exported CSV include a BOM?',
    },
  ],
  help: 'Choose JSON → CSV or CSV → JSON and the Separator (Comma, Semicolon or Tab) that the destination or source really uses, then paste the data or choose a sample.\n\nFor JSON → CSV, paste an array of objects and pick LF or CRLF record endings. Turn on Prefix formula-like text only if you want an apostrophe added to cells such as =1+1.\n\nFor CSV → JSON, keep a named header row. Skip blank lines ignores only truly empty lines; turn it off to keep empty one-column records.\n\nConvert, check the header and records, then copy or save converted.csv, converted.tsv or converted.json. Quoting errors give a line and column; width errors give the record number.',
  notes: [
    'Processing is local. CSV content and formula-like text are never evaluated here.',
    'Export uses UTF-8 without a BOM; a leading BOM is accepted on import. LF, CRLF and CR record endings are read, and newlines inside quoted cells are kept.',
    'CSV has no null, object, array, boolean or number types. Nested values are exported as JSON text, and null, missing properties and empty strings all become empty cells.',
    'Imported cells stay strings: empty cells become "", and JSON text stored in a cell stays a string.',
    'Header names are not trimmed and must be non-blank and unique by exact spelling. Exported column order follows first appearance across records, numeric-looking keys included, and no column is dropped. A key repeated inside one JSON object keeps its last value, as JSON.parse does, and the summary names the key and line.',
    'Numbers are exported as spelled in the JSON, including 1.00, 1e3 and integers beyond ±9,007,199,254,740,991. A spreadsheet may still round long numbers or drop trailing zeros when it opens the file.',
    'Spreadsheets may run formula-like text. The optional apostrophe prefix also covers leading whitespace and full-width markers, but behavior varies by application and it is not a universal sanitizer.',
    'Limits: 5,000,000 characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header, and up to 128 nested JSON levels. An empty JSON array gives an empty file without a header row. Output is never truncated.',
  ],
};
