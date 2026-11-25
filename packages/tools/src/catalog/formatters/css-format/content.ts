import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Formatting puts each selector block on its own line and each declaration on its own indented line. Nested at-rules such as @media and CSS nesting rules are indented one level deeper.\n\nThe tool uses its own small tokenizer, so strings, comments, url() values and escapes are copied exactly as written.',
      title: 'What does CSS formatting do?',
    },
    {
      content:
        'Minify removes comments and layout whitespace. Comments that start with /*! are kept for licenses. Spaces that change meaning, such as in a b, 0 auto or and (, are kept.',
      title: 'What does minify remove?',
    },
  ],
  examples: [
    'a{color:red;margin:0 auto} → a { color: red; margin: 0 auto; } with one declaration per line.',
    '@media (min-width:600px){a{b:c}} → the rule for a is indented inside the media block.',
    'a{content:"}{;"} → the string is kept intact.',
    '/* x */ a { color: #FFFFFF; } → a{color:#FFFFFF} in Minify mode.',
  ],
  faq: [
    {
      answer:
        'No. Colors, units, zeros and shorthands stay exactly as written, so #FFFFFF and 0px are not shortened.',
      question: 'Does minify rewrite my values?',
    },
    {
      answer:
        'No. It does not check property names or values. Only unbalanced braces, unterminated strings and unterminated comments are errors.',
      question: 'Does it validate CSS?',
    },
    {
      answer:
        'Yes. Rules nested with & or plain selectors inside a rule are indented like nested at-rules.',
      question: 'Does it support CSS nesting?',
    },
    {
      answer:
        'Yes, comments that start with /*! are kept. All other comments are removed in Minify mode and kept in Format mode.',
      question: 'Are license comments kept?',
    },
    {
      answer:
        'The error names the line and column of the unclosed block, unexpected brace or unterminated string or comment.',
      question: 'Where is the error in my CSS?',
    },
  ],
  help: 'Paste CSS or choose a sample.\n\nChoose Format to indent the stylesheet, or Minify to remove comments and layout whitespace.\n\nPick 2 spaces, 4 spaces or tabs for Format mode.\n\nCopy the result or save it as a CSS file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 input characters and 100 nesting levels.',
    'Minify never transforms values: colors, units, zeros and shorthands stay as written.',
  ],
};
