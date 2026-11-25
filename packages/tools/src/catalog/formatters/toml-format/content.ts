import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'TOML is a configuration format used by Cargo, pyproject.toml and many other tools. Formatting rewrites its layout without changing the data.\n\nThis tool parses the text, then writes it again with one key per line and table sections. Key order is kept and dates keep their TOML form.',
      title: 'What is TOML formatting?',
    },
    {
      content: [
        'Normalize a hand-edited Cargo.toml or pyproject.toml.',
        'Check a config file for syntax errors before committing it.',
        'Turn inline tables into regular table sections for easier review.',
      ],
      title: 'When to format TOML',
    },
  ],
  examples: [
    'b=1 and a = "x" → b = 1 and a = "x", in the same order.',
    'd = 1979-05-27 → stays a TOML date; d = "1979-05-27" stays a string.',
    '# note above a key → removed in Format mode and counted in the summary.',
    'a = with no value → an error that names the line and column.',
  ],
  faq: [
    {
      answer:
        'Yes. Format mode drops every comment because the text is rewritten from the parsed data. The summary tells you how many were removed. Validate mode keeps your text unchanged.',
      question: 'Does formatting remove comments?',
    },
    {
      answer: 'No. Keys stay in the order you wrote them.',
      question: 'Does it sort keys?',
    },
    {
      answer:
        'No. Local dates, times and offset date-times are written back exactly as they were, without quotes.',
      question: 'Are dates turned into strings?',
    },
    {
      answer:
        'Nested tables are written as [table] sections and arrays of tables as [[table]] sections, so inline tables are expanded.',
      question: 'What happens to inline tables?',
    },
    {
      answer:
        'Only integers outside the signed 64-bit range are refused. Floats such as inf and nan are formatted as they are. Fix the integer and run again.',
      question: 'Which values are refused?',
    },
  ],
  help: 'Paste TOML or choose a sample.\n\nChoose Format to rewrite the text, or Validate to only check the syntax and count comments.\n\nIf parsing fails, use the line and column in the error to fix the problem, then run again.\n\nCopy the result or save formatted.toml.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Format mode removes comments; the summary shows how many. Validate mode returns your input unchanged.',
    'Indentation is not configurable: TOML output uses table sections without indentation.',
    'Keys made only of digits are written in ascending numeric order, because the parser stores them that way.',
    'The limits are 5,000,000 input characters, 128 nesting levels and 8,000,000 characters of key paths. Output is never silently truncated.',
  ],
};
