import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Flattening turns nested JSON into one level of path keys. {"a":{"b":[1]}} becomes {"a.b.0":1}. Every leaf value gets exactly one key that spells out how to reach it.\n\nUnflattening reverses that: each key is split into path segments and the nested objects and arrays are rebuilt. Empty objects and empty arrays count as leaves, so they survive a round trip.\n\nDot notation writes a.b.0.c. Bracket notation writes a.b[0].c and quotes keys that contain separators, such as ["x.y"]. Quoted keys use JSON string escaping, so a key like a"b.c becomes ["a\\"b.c"].',
      title: 'What is JSON flattening?',
    },
    {
      content: [
        'Compare configuration files or API responses key by key with a line-based diff.',
        'Prepare nested data for environment variables, properties files or flat key-value stores.',
        'Rebuild a nested document from flat translation keys or form field names.',
        'Use bracket notation when keys contain dots, brackets or quotes, so the round trip stays exact.',
      ],
      title: 'When to use JSON Flatten & Unflatten',
    },
  ],
  examples: [
    '{"a":{"b":[1,{"c":2}]}} with dot notation → {"a.b.0":1,"a.b.1.c":2}.',
    '{"a":{"b":[1]}} with bracket notation → {"a.b[0]":1}.',
    '{"a":{"b":[1,2]}} with Keep as values → {"a.b":[1,2]}.',
    '{"x.y":1} with bracket notation → {"[\\"x.y\\"]":1}; dot notation rejects it.',
    '{"a.b.0":1,"a.b.1":2} unflattened with dot notation → {"a":{"b":[1,2]}}.',
  ],
  faq: [
    {
      answer:
        'Dot notation cannot tell a key that contains a dot from a path separator, so Flatten rejects such keys and asks you to use bracket notation, which writes them as ["x.y"].',
      question: 'Why does dot notation reject some keys?',
    },
    {
      answer:
        'A node becomes an array only when all of its keys are array indexes and they run exactly 0, 1, 2 and so on. Any gap, or a mix with named keys, gives an object whose keys are the strings "1", "2" and so on.',
      question: 'When does Unflatten create an array?',
    },
    {
      answer:
        'Yes. Keys such as __proto__, constructor and prototype become ordinary data properties of the result and never change Object.prototype or the behavior of other objects.',
      question: 'Is it safe to unflatten keys like __proto__?',
    },
    {
      answer:
        'An empty object or array is a leaf, so it keeps its own key and survives a round trip. A root that is a scalar or empty is returned under the empty key "".',
      question: 'What happens to empty objects and arrays?',
    },
  ],
  help: 'Paste JSON, choose Flatten or Unflatten, and pick a notation. Flatten accepts any JSON value; Unflatten expects an object whose keys are flat paths.\n\nIn Flatten mode, choose whether arrays are indexed into separate keys or kept as values. The Arrays option is hidden in Unflatten mode.\n\nUse bracket notation when a key may contain dots, brackets, quotes or backslashes. Unflatten must use the same notation that produced the keys.\n\nThe summary reports the key count, the notation and the depth, which is the largest number of path segments in a single key.',
  notes: [
    'Runs locally and offline; the input is never uploaded.',
    'Nesting is limited to 64 levels and the result to 100,000 keys; larger input is rejected, not truncated.',
    'Conflicting keys, such as "a" together with "a.b", are rejected instead of overwriting one another.',
    'A duplicate key keeps its last value, as JSON.parse does, and the summary names the key and line.',
    'A number beyond the range of a double, such as 1e400, or one that would become 0, such as 1e-400, is rejected.',
    'Numbers a double cannot hold, such as 12345678901234567890, keep their exact digits.',
    'In dot notation numeric keys come back as arrays when unflattening, so {"a":{"0":1}} returns as {"a":[1]}; use bracket notation to keep them as object keys.',
  ],
};
