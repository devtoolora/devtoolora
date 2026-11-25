import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A structural JSON diff compares values rather than formatting. Whitespace, object key order and equivalent string escapes do not create changes.\n\nAdded, removed and changed entries identify their location with a JSON Pointer and show the original scalar spelling or a compact container value before and after.\n\nObjects match by decoded key; arrays match by zero-based index. Numeric value mode compares exact decimal values without JavaScript floating-point rounding. Exact token mode also detects number spelling changes.',
      title: 'What is a JSON diff?',
    },
    {
      content: [
        'Compare API responses before and after a backend or configuration change.',
        'Inspect which properties were added, removed or changed in a saved fixture.',
        'Compare large numeric identifiers without silently rounding them to the same number.',
        'Check a changed array element or distinguish a missing property from an explicit null value.',
      ],
      title: 'When to compare JSON',
    },
  ],
  examples: [
    '{"a":1,"b":2} vs {"b":2,"a":1} → No differences.',
    '1.00 vs 1e0 → no change in Numeric value mode; one change in Exact token mode.',
    '9007199254740992 vs 9007199254740993 → a change at the root in both modes.',
    '[1,2] vs [1,3,4] → Changed /1 and Added /2.',
    '{} vs {"a":null} → Added /a with Before: Missing; missing is not the same as null.',
  ],
  faq: [
    {
      answer:
        'Yes. Objects are compared key by key, so reordering keys, changing indentation or reformatting the whole document produces no differences. Array order still matters, because array elements are compared by position.',
      question: 'Does JSON Diff ignore key order and whitespace?',
    },
    {
      answer:
        'Sort both arrays the same way, for example by id, before comparing. JSON Diff matches array elements by index only, so one inserted or moved element reports changes at every later index; there is no ID-based matching option.',
      question: 'How do I compare arrays of objects when the order changed?',
    },
    {
      answer:
        'Numeric value mode compares the exact decimal value, so 1, 1.0 and 1e0 are the same number and produce no change. Choose Exact token under Number comparison to report every change in how a number is spelled.',
      question: 'Why are 1.0 and 1 reported as equal?',
    },
    {
      answer:
        'With a duplicate key, a path such as /role could point to either member, so the comparison would be ambiguous. Remove or rename the duplicates first; JSON Format in Validate mode reports each duplicate key with its offset, up to 20 warnings.',
      question: 'Why does JSON Diff reject JSON with duplicate keys?',
    },
    {
      answer:
        'No. Both documents are parsed and compared locally in your browser, editor or desktop app, and nothing is sent to a server. Values in the report are shown as plain text, never rendered as HTML.',
      question: 'Does JSON Diff upload my documents?',
    },
  ],
  help: 'Paste one strict JSON document in Left JSON (before) and one in Right JSON (after), or apply a complete sample.\n\nChoose Numeric value to ignore equivalent decimal spellings, or Exact token to detect changes such as 1 → 1.00. Neither mode rounds numbers.\n\nRun JSON Diff. The visual report lists added, removed and changed paths with before/after columns; choose JSON report for a machine-readable export.\n\nFilter the visual list by change kind. Show more reveals another 200 entries; downloads and Copy always contain every change, regardless of the filter.\n\nIf either input is invalid, the error identifies Left or Right JSON and its line/column. Duplicate object keys must be resolved first because their paths are ambiguous.',
  notes: [
    'Runs locally and offline; values are rendered as text, never as executable HTML.',
    'Object key order is ignored. Array order is significant: insertion at the beginning can change every subsequent index. This is not a move detector or an ID-based array matcher.',
    'A changed type creates one entry for the whole value. Added or removed containers also create one entry, with their complete compact JSON; nested children are not duplicated in the report.',
    'Numeric value comparison is exact decimal comparison, including exponents and numbers beyond JavaScript’s range. -0 equals 0; Exact token treats them as different. Exponents compared as values are limited to 1,000 digits.',
    'Strings compare their decoded content; "a" equals "\\u0061". Unicode normalization is not performed, so composed and decomposed text may differ.',
    'Both inputs must have unique decoded object keys. Strict JSON rejects comments, trailing commas and JavaScript expressions.',
    'Each input supports 1,000,000 characters, 5,000 values and 128 nested containers, with an 8,000,000-character path/label budget. The diff has an 8,000,000-character value/path budget; reports are never silently truncated.',
    'Pointers use RFC 6901: the root is an empty string, ~ becomes ~0 and / becomes ~1 inside a key. A missing before/after value is displayed as Missing, not null.',
    'JSON reports store before/after as JSON text strings to preserve large numbers exactly. Parse these strings only with a precision-safe consumer. The report is a comparison, not an executable JSON Patch.',
  ],
};
