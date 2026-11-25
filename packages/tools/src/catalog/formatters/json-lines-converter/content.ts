import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'JSON Lines (also called JSONL or NDJSON) stores one JSON value per line, separated by a line break. It is common for logs, exports and streaming APIs because a file can be read and appended one record at a time.\n\nJSONL to array parses every non-blank line on its own and collects the values into one JSON array. Blank and whitespace-only lines are skipped and counted. Line breaks can be LF, CRLF or CR, and a leading UTF-8 byte order mark is ignored.\n\nArray to JSONL does the reverse: the top-level array becomes one minified value per line.',
      title: 'What is JSON Lines?',
    },
    {
      content: [
        'Load an exported .jsonl log into a tool that expects one JSON array.',
        'Turn an API response array into a file you can stream or grep line by line.',
        'Find the broken record in a large export: the error names the physical line number.',
        'Prepare data for bulk import endpoints that accept NDJSON.',
      ],
      title: 'When to use JSON Lines ↔ JSON Array',
    },
  ],
  examples: [
    '{"a":1}⏎{"a":2} → [{"a":1},{"a":2}] with Minified indentation.',
    '[1,{"b":2}] → 1⏎{"b":2} in Array to JSONL mode.',
    '{"a":1}⏎⏎{"a":2} → 2 records · 1 blank lines skipped.',
    '{"a":1}⏎{bad → Line 2 is not valid JSON.',
    'A record can be any JSON value, not only an object: 1⏎"text"⏎[1,2] is valid.',
  ],
  faq: [
    {
      answer:
        'JSONL is a text format with one complete JSON value on each line. Files can be appended to and read record by record without loading the whole document.',
      question: 'What is JSONL?',
    },
    {
      answer:
        'Each record must stay on one physical line, because a line break is the separator between records. Pretty-printed JSON would split a record across lines and break the format.',
      question: 'Why are the output lines minified?',
    },
    {
      answer:
        'The JSON Lines Inspector profiles a log: fields, types and bad lines. This tool converts the data to a JSON array or back, and stops with an error at the first invalid line.',
      question: 'How is this different from the JSON Lines Inspector?',
    },
  ],
  help: 'Choose a direction. JSONL to array parses each line and returns a JSON array, with the indentation you pick or Minified.\n\nArray to JSONL expects a top-level JSON array and writes one minified value per line.\n\nIn JSONL mode an invalid line stops the conversion and the error shows its line number, counting blank lines, so it matches your editor.\n\nThe summary shows how many records were read and how many blank lines were skipped.',
  notes: [
    'Runs locally and offline; the input is never uploaded.',
    'Input is limited to 10,000,000 UTF-16 units and 100,000 lines.',
    'A duplicate key keeps its last value, as JSON.parse does, and the summary names the key and line.',
    'A number beyond the range of a double, such as 1e400, or one that would become 0, such as 1e-400, is rejected.',
    'Numbers a double cannot hold, such as 12345678901234567890, keep their exact digits.',
    'A textarea may normalize CRLF to LF; the result is the same either way.',
  ],
};
