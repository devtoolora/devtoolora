import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'JSON is a text format for objects, arrays, strings, numbers, booleans and null. A complete document can also be a single scalar, not just an object or array.\n\nFormatting adds whitespace for readability; minification removes whitespace outside strings. Validation checks the grammar without fixing or executing the source.\n\nThis tool retains the original number tokens, string escapes, key order and duplicate keys. Unlike a parse-and-stringify formatter, it does not round large numeric identifiers or rewrite 1.00 as 1.',
      title: 'What is JSON formatting?',
    },
    {
      content: [
        'Format an API response, configuration or test fixture to inspect its nested structure.',
        'Minify JSON for a destination that expects a compact text payload, without removing spaces inside string values.',
        'Validate syntax before copying a document elsewhere, and inspect duplicate-key or numeric-range warnings.',
        'Use JSON Schema Validator for required properties and data types; syntax validation alone does not check application rules.',
      ],
      title: 'When to format or validate JSON',
    },
  ],
  examples: [
    '{"id":9007199254740993,"price":1.00} → both numeric tokens stay exactly 9007199254740993 and 1.00.',
    '{ "message": "a b", "escaped": "\\u0061" } → {"message":"a b","escaped":"\\u0061"} in Minify.',
    '{"role":"user","role":"admin"} → both members kept, unchanged apart from whitespace, plus a duplicate-key warning.',
    'null → Valid JSON, Type: null; null is not reported as an object.',
    '{"ok":true,} → a "Trailing commas are not valid JSON" error at line 1, column 12; nothing is repaired.',
  ],
  faq: [
    {
      answer:
        'No. Keys stay in their original order, including duplicates, because only whitespace outside strings changes. There is no sort option, so reorder the keys in the source if you need a canonical order.',
      question: 'Does JSON Format sort keys alphabetically?',
    },
    {
      answer:
        'The first character is not part of a JSON value. A common cause is a non-breaking space or another invisible character copied with the text; only spaces, tabs and line breaks count as JSON whitespace. One leading byte order mark (U+FEFF) is ignored, but a second one is rejected. Delete the hidden character and run again.',
      question: 'Why is valid-looking JSON rejected at line 1, column 1?',
    },
    {
      answer:
        'No. Comments, trailing commas, single quotes and unquoted keys are reported with a line and column instead of being fixed, so nothing in your data changes silently. Correct the source at that position and run again.',
      question: 'Can JSON Format repair invalid JSON?',
    },
    {
      answer:
        'No. Every number keeps its exact spelling, so 1.00 stays 1.00 and 9007199254740993 is not rounded. Numbers outside JavaScript’s safe range get a warning, because the program that later reads the JSON may still round them.',
      question: 'Will formatting change numbers such as 1.00 or large IDs?',
    },
    {
      answer:
        'Format adds indentation and line breaks, Minify removes all whitespace outside strings, and Validate returns a report with the root type, value counts, depth and warnings instead of JSON. All three modes check the same strict grammar.',
      question: 'What is the difference between Format, Minify and Validate?',
    },
    {
      answer:
        'No. Formatting, minifying and validation run locally in your browser, editor or desktop app. The JSON is never uploaded, executed or used to fetch anything.',
      question: 'Is my JSON uploaded anywhere?',
    },
  ],
  help: 'Paste one JSON document or choose a sample. Select Format, Minify or Validate; all three modes check the same strict grammar.\n\nFor Format, choose two spaces, four spaces or tabs and LF or CRLF line endings. These settings do not affect Minify or the validation report.\n\nRun the tool. Invalid input reports a one-based line and column plus a zero-based UTF-16 offset; fix the source at that location and run again.\n\nInspect the summary for duplicate keys or numbers outside JavaScript’s safe range. Choose Validate to read warning details; warnings do not modify the source.\n\nCopy or download the result. Formatting and minification produce a JSON file; validation produces a text report, not a corrected document.',
  notes: [
    'Runs locally and offline. JSON is never executed, uploaded or used to fetch remote content.',
    'Strict JSON only: double-quoted keys and strings, no comments, trailing commas, single quotes, NaN, Infinity, undefined or JavaScript expressions. A single leading byte order mark (U+FEFF) is ignored and not written to the output.',
    'Only whitespace outside strings changes. Original key order, escapes, negative zero, decimal trailing zeroes and exponent notation are retained; keys are not sorted.',
    'Duplicate keys are valid grammar but unreliable across consumers. The tool preserves all occurrences and reports their decoded names, including equivalent escaped keys.',
    'Number spelling is preserved even beyond JavaScript’s range. A warning is not a complete precision analysis: ordinary decimals may also be rounded by downstream consumers. Quote identifiers if the receiving system requires strings.',
    'Supports up to 1,000,000 UTF-16 input characters, 100,000 values and 128 nested containers. Formatted output is limited to 8,000,000 characters.',
    'Validation reports root type, values, containers, maximum container depth and warning counts. Values include the root and array/object values, not object keys; at most 20 warning details are shown.',
    'Syntax validation does not check a JSON Schema, business rules, duplicate-key safety or Unicode interoperability. Unpaired surrogate escapes are accepted by JSON grammar and retained.',
    'The original JSON Minify and JSON Validate URLs and commands still work, defaulting to their respective modes; they share this workspace and guide.',
  ],
};
