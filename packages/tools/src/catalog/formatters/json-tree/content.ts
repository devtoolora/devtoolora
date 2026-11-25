import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A JSON tree shows objects as named members, arrays as zero-based indexes, and scalar values with their actual JSON type. Empty containers, null and empty strings remain distinct.\n\nThis viewer preserves number spelling and every duplicate member instead of converting the input into JavaScript objects. A separate text outline is available for copying or saving.\n\nEach row has an RFC 6901 JSON Pointer. The root pointer is the empty string; / separates segments, and ~0 and ~1 escape a tilde and a slash inside a key.',
      title: 'What is a JSON tree?',
    },
    {
      content: [
        'Explore a nested API response without scrolling through a fully expanded JSON document.',
        'Find a key, path, type or scalar token, including matches inside collapsed branches.',
        'Inspect the exact type, full scalar token and pointer of a value before writing a test or a query.',
        'Spot empty arrays, null values, numeric strings and duplicate keys that a conventional object viewer can hide.',
      ],
      title: 'When to use JSON Tree',
    },
  ],
  examples: [
    '{"id":9007199254740993} → a number row showing 9007199254740993, not 9007199254740992.',
    '{"users":[{"name":"Ada"}]} → the name row has pointer /users/0/name.',
    '{"a/b~c":1} → pointer /a~1b~0c, not /a/b~c.',
    '{"a":null,"b":"","c":[],"d":{}} → null, string, array[0] and object[0] rows.',
    '{"role":"user","role":"admin"} → two "role" rows that share the ambiguous pointer /role.',
  ],
  faq: [
    {
      answer:
        'Select its row and choose Copy pointer. You get an RFC 6901 JSON Pointer such as /users/0/name, which JSON Query accepts directly when Path syntax is set to JSON Pointer.',
      question: 'How do I copy the path of a value?',
    },
    {
      answer:
        'Tree mode accepts up to 5,000 values, counting every object, array and scalar, and 1,000,000 characters. For a larger document, paste only the branch you need, or inspect the whole document with JSON Format, which accepts up to 100,000 values.',
      question: 'Why is my large JSON file rejected?',
    },
    {
      answer:
        'No. JSON Tree is a read-only viewer and never modifies the input. Edit the source text, then run JSON Tree again to refresh the outline.',
      question: 'Can I edit values in the tree?',
    },
    {
      answer:
        'The object contains the same key twice. JSON Tree keeps both members as separate rows, but a JSON Pointer cannot tell them apart and other tools may read only one of them, so remove the duplicate before using the pointer.',
      question: 'Why do two rows have the same pointer?',
    },
    {
      answer:
        'Yes. Strings are displayed as plain text, so markup such as <img src=x onerror=…> appears literally and is never rendered or run.',
      question: 'Is it safe to view JSON that contains HTML or scripts?',
    },
  ],
  help: 'Paste one strict JSON document or apply a sample, then run JSON Tree. Invalid syntax includes a line and column.\n\nExpand or collapse a container with its disclosure button. Expand all and Collapse all affect the outline; search temporarily reveals matching rows and their ancestors.\n\nSelect a row to inspect its type, child count and pointer. Scalar details show the full original JSON token, including quotes and escapes.\n\nUse Copy pointer for the selected path or Copy scalar token for an exact scalar. The root pointer copies an empty string. These actions do not copy a container’s full JSON.\n\nThe outline displays up to 200 rows at a time; Show more reveals another 200. Copy and Download json-tree.txt always include the full outline, independent of the current search and collapsed branches.',
  notes: [
    'Runs locally and offline. Strings render as text, never as HTML or executable content.',
    'Strict JSON grammar only. Comments, trailing commas and JavaScript expressions are rejected, not repaired.',
    'Supports 1,000,000 input characters, 5,000 values and 128 nested containers. Combined pointer/label text and the text export each have an 8,000,000-character limit; excessive input is rejected, not truncated.',
    'Object order and duplicate keys are preserved. Duplicate keys produce ambiguous JSON Pointers; distinguish the separate rows by their outline position. Remove duplicates before using a pointer in another system.',
    'Numbers retain their source spelling, including large integers, trailing zeroes and exponent notation. Consumers can still lose precision; this viewer is not a numeric calculator.',
    'Search is a case-insensitive literal substring over displayed keys, pointers, types and original scalar tokens. Escaped string tokens are searched in source form, not decoded string form.',
    'Row previews shorten long labels and scalar tokens; selecting a row shows the complete pointer and scalar token. Indentation is visually capped at 12 levels on narrow layouts; pointers retain full depth.',
    'The downloaded text is a typed outline, not valid JSON or a round-trip format. Use JSON Format to download a JSON document.',
  ],
};
