import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'JSON Lines stores one JSON value per line. This inspector intentionally profiles object records only, not arrays, numbers or other primitive records.',
        'It counts nonblank records, valid objects and malformed/non-object records, then profiles top-level field types and presence among valid objects.',
        'Blank lines are ignored for counting, but diagnostics retain original source line numbers. Nested values are classified, not recursively profiled.',
      ],
      title: 'What is JSON Lines inspection?',
    },
    {
      content: [
        'Inspect structured application logs without discarding valid lines after an error.',
        'Find missing fields or mixed top-level types.',
        'Use JSON Tree for one nested document and CSV Profiler for tabular data.',
      ],
      title: 'When to use JSON Lines Inspector',
    },
  ],
  examples: [
    '{"a":1} and {"a":2} → Records: 2, Valid objects: 2, Malformed: 0.',
    '{"id":1,"optional":true} and {"id":2} → optional has Present: 1/2.',
    'null → Line 1: Expected a JSON object.',
    '{"id":1}, a blank line and {"id":2} → Records: 2.',
    '{"id":1}, a blank line and not json → Line 3: Invalid JSON.',
    '{"tags":["demo"]} → tags has Types: array; nested elements are not analyzed.',
  ],
  faq: [
    {
      answer:
        'JSON Lines, also called JSONL or NDJSON, holds one complete JSON value per line, while a JSON file is a single document. A pretty-printed object spread over several lines is reported as several invalid lines here.',
      question: 'What is the difference between JSON Lines and JSON?',
    },
    {
      answer:
        'Not as records. [{"a":1},{"a":2}] on one line counts as one non-object record and reports “Expected a JSON object”. Put each object on its own line instead.',
      question: 'Can it read a JSON array of objects?',
    },
    {
      answer:
        'Lines are parsed with JSON.parse, which turns 1.0 into the number 1, so it is classified as integer while 1.5 is number. The original spelling of a number is not kept.',
      question: 'Why is 1.0 counted as an integer?',
    },
    {
      answer:
        'No. It reports top-level field types and how many valid objects contain each field, such as Present: 1/2. Nested objects and arrays are classified but not inspected.',
      question: 'Does it validate records against a schema?',
    },
    {
      answer:
        'No. The report lists field names, types, counts and line numbers, and diagnostics for invalid lines do not quote them. Field names are still shown, so review them before sharing.',
      question: 'Does the report show my log values?',
    },
  ],
  help: 'Paste JSONL, not one pretty-printed multiline JSON document.\n\nRun inspection and read the record counts.\n\nReview each field profile and diagnostic line number.\n\nCopy or download the Markdown report; original valid records are not returned.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters. No network requests or execution of log contents occur.',
    'Reports and transformed logs may still contain names, paths, identifiers or personal data. Review before copying or sharing.',
    'Number classifications reflect JavaScript parsing, not exact integer preservation or schema validation.',
    'Duplicate keys inside an object follow JSON.parse last-key behavior; this tool does not detect them.',
    'All malformed JSON diagnostics are generic and do not echo parser snippets. Field names remain visible.',
    'A stream of primitive JSON values may be valid JSONL elsewhere but is outside this object-only profile.',
  ],
};
