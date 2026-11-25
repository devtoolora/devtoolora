import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Blank lines can be removed, collapsed to one, or kept. With collapse, each run of blank lines becomes a single blank line, which keeps paragraph breaks and drops the extra gaps. Whitespace-only lines count as blank by default; turn that option off to treat only completely empty lines as blank.\n\nEvery line you keep keeps its own line ending. CRLF stays CRLF, a lone CR stays a lone CR, and a last line without a line break stays without one.',
      title: 'How are blank lines handled?',
    },
    {
      content:
        'A line number is removed only in a recognized form: optional spaces or tabs, 1 to 9 digits, then a period, a closing parenthesis, a colon or a vertical bar (optionally after spaces) that is followed by a space, a tab or the end of the line, or else a tab straight after the digits. At most one following space or tab is removed. So 1. one, 2) two, 3: three, 4 | four and 5 then a tab are all cleaned, while 3.14, 10:30 and 1|2 are not.\n\nA number followed by only a space, as in 2024 was good, is removed only when there are at least two non-blank lines, every one starts with a number and a space, and the numbers count up by one. That is how editors copy numbered code, and it keeps ordinary sentences safe.',
      title: 'Which line numbers are removed?',
    },
  ],
  examples: [
    'a, two blank lines, b → a and b on adjacent lines',
    'a, two blank lines, b with Collapse to one → a, one blank line, b',
    '1. one → one',
    '  12 const a and 13 const b on the next line → const a and const b',
    '2024 was good, not numbered → unchanged',
    '3.14 is pi and 10:30 standup → unchanged',
  ],
  faq: [
    {
      answer:
        'Yes. Every kept line keeps the exact line ending it had, including CRLF and a lone CR. A last line without a line break stays without one.',
      question: 'Are Windows line endings preserved?',
    },
    {
      answer:
        'Only in the recognized forms: digits, then a period, parenthesis, colon or bar followed by a space, a tab or the line end, or a tab. Decimals and times such as 3.14, 10:30 and 1.2.3 stay. A bare space after the number counts only when every non-blank line has it and the numbers count up by one.',
      question: 'Will it remove numbers that are part of my text?',
    },
    {
      answer:
        'Turn off Whitespace-only lines are blank. Then only lines with no characters at all count as blank, and a line holding spaces or tabs is kept.',
      question: 'How do I keep lines that contain only spaces?',
    },
    {
      answer:
        'A line like 3. with nothing after the number loses its number and becomes empty. It is then treated as blank, so it is removed or collapsed together with the other blank lines.',
      question: 'What happens to a numbered line with no text?',
    },
  ],
  help: 'Paste text as the main input, or select it in the editor.\n\nChoose what to do with blank lines: Remove, Collapse to one, or Keep. Decide whether lines with only spaces or tabs count as blank.\n\nChoose whether to Remove or Keep line numbers.\n\nRun the tool. Copy the result, replace the selection with it, or save it as cleaned.txt.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 1,000,000 characters of input.',
    'Line numbers are recognized only at the start of a line and have at most 9 digits.',
    'A delimiter must be followed by a space, a tab or the end of the line, so decimals, times and versions such as 3.14, 10:30 and 1.2.3 are kept.',
  ],
};
