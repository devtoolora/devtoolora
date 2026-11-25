import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A JSON Patch (RFC 6902) is a JSON array of operations that turns one document into another. Each operation has an op and a JSON Pointer path such as /users/0/name; add, replace and test also carry a value, and move and copy read a from pointer.\n\nIn a pointer, ~1 stands for / and ~0 for ~, so the key "a/b" is written /a~1b. An empty path is the whole document, and - after an array path means the end of that array.',
      title: 'What is a JSON Patch?',
    },
    {
      content:
        'Generate compares the original with the target the way JSON Diff does: objects by key, arrays by index, numbers by value. An added value becomes add, a removed one remove and a changed one replace. Array removals are written from the highest index down, so the patch applies in order.\n\nApply runs add, remove, replace, move, copy and test on a parser that keeps number spelling and key order. If any operation fails, the whole patch stops with an error naming the operation, and nothing is partly applied.',
      title: 'How are patches generated and applied?',
    },
  ],
  examples: [
    '{"a":1} to {"a":2} → [{"op":"replace","path":"/a","value":2}].',
    '[1,2,3] to [1] → remove /2, then remove /1.',
    '{"a/b":1} to {} → [{"op":"remove","path":"/a~1b"}].',
    'Apply [{"op":"add","path":"/tags/-","value":"x"}] to {"tags":[]} → {"tags": ["x"]}.',
    'Apply [{"op":"test","path":"/n","value":1e0}] to {"n":1.0} → passes, because numbers compare by value.',
  ],
  faq: [
    {
      answer:
        'Arrays are compared by index, as in JSON Diff, not by searching for moved elements. Inserting at the front of an array therefore becomes replace operations plus one add at the end. The patch is still correct, just not the shortest one.',
      question: 'Why does inserting one array element produce many operations?',
    },
    {
      answer:
        'No. Generate only writes add, remove and replace. Apply understands all six operations, including move, copy and test, so you can edit a generated patch by hand.',
      question: 'Does Generate write move, copy or test operations?',
    },
    {
      answer:
        'Yes. Numbers keep their original spelling, so 1.50 stays 1.50 and 9007199254740993 stays exact. Existing keys keep their position and new keys are added at the end of their object.',
      question: 'Are numbers and key order preserved?',
    },
    {
      answer:
        'test passes when the values are equal as JSON: 1.0 equals 1e0, and objects match without regard to key order. Strings must match exactly, and arrays element by element.',
      question: 'How does the test operation compare values?',
    },
    {
      answer:
        'The error names the 1-based operation, its op and path, and the reason, for example Operation 2 (remove /a/5): array index 5 is out of range 0-3. Nothing from the patch is applied.',
      question: 'What happens when an operation fails?',
    },
  ],
  help: 'Choose Generate patch or Apply patch.\n\nPaste the original JSON as the main input.\n\nTo generate, paste the Target JSON; to apply, paste the JSON Patch array.\n\nRun the tool, then copy the result or save it as patch.json or patched.json.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 UTF-16 units per document; generate: 100,000 values per side; apply: 10,000 operations, 128 nesting levels and 5,000,000 copied characters in total.',
    'Arrays are compared by index, so an insert or removal near the front of an array becomes replace operations plus an add or remove at the end. There is no minimal array diff.',
    'A duplicate key in a JSON document keeps its last value, as JSON.parse does, and the summary names the key and line. A duplicate key in the patch operation list is rejected, because it is unclear which operation was meant.',
    'Unknown members of an operation are ignored, as RFC 6902 says. JSON Merge Patch (RFC 7386) is not supported.',
  ],
};
