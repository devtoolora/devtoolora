import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A regular expression packs a search rule into a few symbols, which makes it quick to write and slow to read. This tool parses a JavaScript pattern and prints it as a tree: one line per piece, indented by nesting, with a plain-English sentence next to each piece.',
        'The parser follows the ECMAScript 2025 grammar: groups, named groups, lookahead and lookbehind, modifier groups such as (?i:…), quantifiers, character classes, Unicode property escapes and the v-flag set operations. The pattern is only parsed; nothing is matched against text.',
        'Everything runs in your browser. You can paste a bare pattern or a whole /pattern/flags literal copied from code.',
      ],
      title: 'What does a regex explainer do?',
    },
    {
      content: [
        'Read a pattern you inherited before you change it.',
        'Check that a pattern you wrote groups and repeats what you meant.',
        'Spot a nested quantifier that can backtrack heavily on input that does not match.',
        'Learn what a lookbehind, a v-flag set or a modifier group means.',
      ],
      title: 'When to use Regex Explainer',
    },
  ],
  examples: [
    '^(?<year>\\d{4})-(\\d{2})$ → a named group "year" (group 1) and a second capture group, each with exactly the digit count.',
    '/a\\/b/gi → the literal is split at its last slash; the pattern a\\/b is explained with flags g and i.',
    '^.+?$ with flag m → Start of a line, any character one or more times as few times as possible, End of a line.',
    '(?<=\\$)\\d+ → Preceded by the character "$", then a digit one or more times.',
    '[[a-z]--[aeiou]] with flag v → one character from the set: a to z, Minus, a set of vowels.',
    '((a+)+)$ → a warning for the nested unbounded quantifier at index 5.',
  ],
  faq: [
    {
      answer:
        'Both. A selection such as /\\d+/gi is split at its last slash and the letters after it become the flags. If the Flags field also has text, the pasted flags win and the summary says so.',
      question: 'Should I paste the slashes and flags?',
    },
    {
      answer:
        'The tool parses the ECMAScript 2025 grammar itself and then lets this browser compile the pattern. If the parser accepts a pattern the browser rejects, the error says the runtime may be older than the syntax.',
      question: 'Why does a valid-looking pattern fail?',
    },
    {
      answer:
        'An unbounded quantifier, such as + or *, wraps a group that holds another one, as in (a+)+. On text that almost matches, the engine can try exponentially many splits. Bound the inner part or remove the nesting.',
      question: 'What is the nested quantifier warning?',
    },
    {
      answer:
        'No. The explainer only parses the pattern and needs no subject text. To see matches and captures on real text, open Regex Tester, which runs the pattern in an isolated worker.',
      question: 'Does it test the pattern on my text?',
    },
    {
      answer:
        'Groups are numbered by their opening parenthesis from left to right, as the engine does. Named groups count too, and a repeated name in different alternatives keeps a distinct number each time.',
      question: 'How are capture groups numbered?',
    },
  ],
  help: 'Paste a regular expression into the input. A bare pattern such as ^(?<year>\\d{4})$ works, and so does a literal copied from code such as /^(?<year>\\d{4})$/u. Type the flags in the Flags field when you paste a bare pattern.\n\nThe result is a header with the flags in words, then one line per piece of the pattern. Groups and classes print their opening bracket, their contents one level deeper and a closing line. Quantifiers are folded into the line of the piece they repeat, for example a digit exactly 4 times.\n\nThe summary counts the explained nodes and the warnings. The one structural warning flags an unbounded quantifier on a group that contains another unbounded quantifier, which can backtrack heavily on input that does not match. The JSON file lists every node with its start, end and explanation.\n\nA pattern that this browser rejects, or one the parser does not know, gives a short error with an index instead of the raw engine message. Backreference numbers and group names are explained, not resolved against text.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: a pattern of 10,000 UTF-16 units, 10,000 nodes, nesting depth 64 and output of 500,000 characters.',
    'Positions in the JSON file are zero-based UTF-16 offsets into the pattern, with an exclusive end.',
    'Plain characters next to each other are shown as one line, so abc reads as The characters "abc".',
    'An escape is explained by code point, for example \\n as U+000A, with the character in quotes when it is printable; an escaped punctuation mark such as \\$ or \\/ reads as the character itself.',
    'Only the v flag allows nested classes, -- and && set operations and \\q{…} strings.',
  ],
};
