import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'TOML is a configuration format with typed key/value assignments, table sections, arrays of tables, multiline strings and date/time values. JSON objects map to TOML tables and JSON arrays to TOML arrays.\n\nJSON → TOML writes [section] and [[array-of-tables]] blocks, or inline objects for compact output. TOML has no null, so null is rejected with its JSON Pointer instead of being dropped or turned into empty text.\n\nTOML → JSON parses real TOML syntax, keeps integer digits exact and turns typed dates and times into JSON strings with their original spelling, because JSON has no date type.',
      title: 'What is JSON ↔ TOML conversion?',
    },
    {
      content: [
        'Prepare configuration for software that reads TOML, such as Cargo.toml or pyproject.toml files.',
        'Read a TOML configuration as JSON for an API, fixture or schema check.',
        'Move exact 64-bit identifiers between the formats without rounding them.',
        'See date/time and large-integer type changes before sharing a configuration.',
      ],
      title: 'When to convert between JSON and TOML',
    },
  ],
  examples: [
    'JSON → TOML: {"server":{"port":3000}} → a [server] table with port = 3000.',
    'JSON → TOML: {"users":[{"name":"Ada"},{"name":"Grace"}]} → two [[users]] tables.',
    'JSON → TOML: {"value":null} → an error at /value; it does not become "".',
    'TOML → JSON: id = 9007199254740993 stays exact, or becomes "9007199254740993" with Strings for large integers.',
    'TOML → JSON: date = 2026-10-11 → "2026-10-11"; JSON has no date type.',
    'TOML → JSON: value = inf or nan → an error; JSON cannot represent non-finite numbers.',
  ],
  faq: [
    {
      answer:
        'TOML has no null type, so JSON → TOML stops with the JSON Pointer of the null value instead of dropping it or writing an empty string. Remove the key or replace null with a value your application understands.',
      question: 'Why can’t JSON with null be converted to TOML?',
    },
    {
      answer:
        'No. JSON has no comment syntax, so TOML comments are removed, and converting the JSON back to TOML cannot restore them. Keep the original file if its comments matter.',
      question: 'Does TOML to JSON keep comments?',
    },
    {
      answer:
        'They become JSON strings with their original spelling, fractional seconds and offset, for example 2026-10-11T12:30:00Z → "2026-10-11T12:30:00Z". Local dates and times are not given a timezone.',
      question: 'How are TOML dates and times converted to JSON?',
    },
    {
      answer:
        'A TOML document is always a table of keys, so a root array, string or number cannot be represented and is rejected. Wrap the value in an object, for example {"items":[…]}.',
      question: 'Why does JSON to TOML need an object at the root?',
    },
    {
      answer:
        'With Table sections, each object becomes its own [[name]] block, TOML’s array-of-tables syntax. Inline objects writes them on one line as name = [{ … }, { … }]. An array that mixes objects with other values always stays inline.',
      question: 'How are arrays of objects written in TOML?',
    },
    {
      answer:
        'It writes TOML integers outside ±9,007,199,254,740,991 as JSON strings, so JavaScript cannot round them while parsing. With Exact JSON numbers the digits are kept unquoted, but many JSON readers will round them.',
      question: 'What does Strings for large integers do?',
    },
  ],
  help: 'Choose JSON → TOML or TOML → JSON, then paste a document or choose a sample. The JSON root must be an object; comment-only TOML becomes {}.\n\nFor JSON → TOML, choose Table sections for readable nested configuration or Inline objects for compact assignments.\n\nFor TOML → JSON, choose exact JSON numbers or strings for large integers and the JSON indentation. Syntax errors report the TOML line and column.\n\nCopy the result or save converted.toml or converted.json; the summary counts date/time strings and large integers. Use result & reverse to check a round trip.',
  notes: [
    'Conversion runs locally and offline with smol-toml 1.9.0 and TOML 1.1 syntax. No eval, includes, file access or remote requests are used.',
    'Up to 1,000,000 input characters, 5,000 values and 128 nested levels are supported; output is limited to 8,000,000 characters.',
    'Duplicate TOML assignments, conflicting tables and null anywhere in JSON are rejected rather than dropped. A duplicate JSON key keeps its last value, as JSON.parse does, and the summary names the key and line. Empty arrays and objects are kept as [] and {}; a root {} becomes a comment-only TOML document.',
    'Integers must fit the signed 64-bit range and keep every digit, even beyond JavaScript’s safe range. Hex, octal, binary and underscore forms become decimal JSON; string mode quotes only integers outside ±9,007,199,254,740,991.',
    'Floats must be finite. JSON → TOML keeps their spelling; TOML → JSON uses binary64 precision, so trailing zeros and extra digits are not kept. Use strings for exact decimals.',
    'Typed TOML dates and times become strings with their spelling, precision and offset, and local values get no timezone. Date-looking JSON strings stay quoted TOML strings.',
    'Comments, key order, quote style, indentation and table placement are not preserved. Output uses LF and a final newline, and Unicode text is not normalized.',
    '__proto__ and constructor are kept as ordinary data keys and are never treated as prototypes.',
  ],
};
