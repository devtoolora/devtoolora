import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A JSON query selects one value inside an object or array. The result can be a scalar, an empty container, or an entire nested structure.\n\nSimple path uses named steps and zero-based indexes, such as $.users[0].name. JSON Pointer uses slash-separated steps, such as /users/0/name; this is the same path format used by JSON Tree and JSON Diff.\n\nExtraction preserves original numbers, string escapes, key order and duplicate members inside the selected value. It does not parse numbers into JavaScript floating-point values.',
      title: 'What is a JSON query?',
    },
    {
      content: [
        'Extract a property from an API response, fixture or configuration without manually copying nested braces.',
        'Paste a JSON Pointer copied from JSON Tree or JSON Diff to inspect that value.',
        'Select keys containing dots, spaces, quotes, slashes or tildes without confusing them with path separators.',
        'Distinguish a missing property from a valid null, false, zero, empty string or empty collection.',
      ],
      title: 'When to query JSON',
    },
  ],
  examples: [
    '{"users":[{"name":"Ada"}]} with $.users[0].name or /users/0/name → "Ada".',
    '{"a.b":{"a/b~c":1}} with $["a.b"]["a/b~c"] or /a.b/a~1b~0c → 1.',
    'Simple path $ or an empty JSON Pointer → the entire document, formatted.',
    '{"":null,"other":false} with pointer / → null, the value of the empty-string key, not the root.',
    '{"id":9007199254740993} with $.id → 9007199254740993 with its exact digits.',
  ],
  faq: [
    {
      answer:
        'Only a small subset. Simple path supports names, [0] indexes and quoted bracket keys; wildcards such as [*], recursive descent (..), filters and slices are rejected with an error. Each query selects exactly one value.',
      question: 'Is this a full JSONPath implementation?',
    },
    {
      answer:
        'Use a quoted bracket key, such as $["a.b"] or $["first name"], or switch to JSON Pointer and write /a.b. Inside a pointer, write ~1 for a slash and ~0 for a tilde that are part of a key.',
      question: 'How do I select a key that contains a dot or a space?',
    },
    {
      answer:
        'No. Array indexes must be zero or positive whole numbers without leading zeros, so [-1] is a syntax error. Check the array length in JSON Tree, then use the last index explicitly.',
      question: 'Can I use a negative index such as [-1] for the last item?',
    },
    {
      answer:
        'Both select the same value. Simple path looks like $.users[0].name and is easy to type; JSON Pointer (RFC 6901) looks like /users/0/name and is the format that JSON Tree and JSON Diff copy, so you can paste their paths directly.',
      question: 'What is the difference between Simple path and JSON Pointer?',
    },
    {
      answer:
        'Only when the path starts with a bracket: users[0].name works, but [0].id must be written $[0].id. A lone $ selects the whole document.',
      question: 'Do I need a leading $ in a simple path?',
    },
  ],
  help: 'Paste one strict JSON document or apply a complete sample. Choose the path syntax before entering your query.\n\nFor Simple path, use named steps, [0] indexes and single- or double-quoted bracket keys. A leading $ is optional for named paths; $ alone selects the root. Numeric dot steps such as users.0.name are also supported.\n\nFor JSON Pointer, paste the raw path from Tree or Diff. It starts with /, or is empty for the root; ~0 represents ~ and ~1 represents / inside a key.\n\nRun JSON Query. Selected value outputs valid formatted JSON, including quotes around strings. Query report adds the pointer and type, with the value stored as exact JSON text.\n\nCopy or download selected.json or json-query-report.json. Errors distinguish invalid syntax, missing values, invalid indexes and ambiguous duplicate keys.',
  notes: [
    'Runs locally and offline. Queries are parsed as data; no eval, scripts, remote requests or prototype traversal are used.',
    'Simple path is a deliberately limited selector, not complete JSONPath: no wildcards, slices, filters, recursive descent, unions or expressions. Use quoted bracket keys for punctuation or non-ASCII names.',
    'Pointers follow RFC 6901. URI fragments such as #/users/0 and percent-decoding are not supported. Empty pointer and / have different meanings.',
    'Array indexes must be nonnegative base-ten integers without leading zeros; - does not refer to an existing element. Object keys such as "01" remain accessible with quoted keys or a pointer.',
    'Only actual JSON object members are accessible. __proto__ and constructor are ordinary keys only when explicitly present in the source.',
    'If a queried step matches duplicate decoded keys, it is rejected as ambiguous. Duplicates elsewhere, including inside a selected container or root, are retained rather than silently dropped.',
    'Supports 1,000,000 input characters, 5,000 values, 128 nested containers, 16,384 query characters and an 8,000,000-character path/label budget. Formatted selected output is limited to 8,000,000 characters.',
    'Number spelling and string escapes are preserved; no Unicode normalization is applied. Receiving systems may still round numbers. Query report stores the selected JSON as a string to keep exact tokens portable.',
  ],
};
