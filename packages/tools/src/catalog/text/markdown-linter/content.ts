import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A Markdown linter reads a document and lists the places where it breaks a style rule: a heading that skips a level, a list that mixes bullet markers, trailing spaces, hard tabs, a code fence without a language or a link to a section that does not exist.',
        'This tool runs ten rules that use markdownlint ids and names, so you can look a finding up in its documentation. Results can differ from the CLI, as the FAQ explains. The document is parsed with markdown-it in CommonMark mode and every finding carries a line and a column. Nothing leaves your browser, and the tool never rewrites your text.',
      ],
      title: 'What does a Markdown linter do?',
    },
    {
      content: [
        'Check a README or docs page before you open a pull request.',
        'Find a #fragment link that no longer matches a heading after a rename.',
        'Spot trailing spaces, tabs and doubled blank lines that make a diff noisy.',
        'Confirm that a file with front matter and CRLF line endings still reports the right line numbers.',
      ],
      title: 'When to use Markdown Linter',
    },
  ],
  examples: [
    '# Title, then ### Skipped → 3:1 MD001 [Expected: h2; Actual: h3] because a level was jumped.',
    'text followed by three spaces at the end of a line → MD009 [3 spaces]; exactly two spaces are a hard break and pass.',
    '* a, a blank line, then - c → 4:1 MD004 [Expected: asterisk; Actual: dash].',
    'A fence that starts with three backticks and no word → MD040 [No language]; ~~~js passes.',
    '[usage](#Usage) with a heading ## Usage → passes, because fragments are compared without case.',
    'A file whose last line has no newline → MD047 [No final newline] at the end of that line.',
  ],
  faq: [
    {
      answer:
        'No. The ten rules use its ids and names, but only a subset of its 50-plus rules exists and the options are fixed. Some differ from its defaults: MD010 skips code blocks, MD051 ignores case, and MD001 and MD025 do not count a front matter title as a heading.',
      question: 'Is this the same as markdownlint?',
    },
    {
      answer:
        'Yes. A trailing carriage return is removed from every line before the rules run, and a YAML front matter block is blanked, so line numbers match your file and the blank lines in the block do not count.',
      question: 'Does it handle CRLF files and front matter?',
    },
    {
      answer:
        'It builds the heading slugs the way GitHub does: lower case, punctuation removed, spaces as hyphens, and -1, -2 for repeated headings. HTML id and name attributes, {#custom} heading anchors, #top and GitHub line links such as #L20 also count as targets, and the comparison ignores case.',
      question: 'How are link fragments checked?',
    },
    {
      answer:
        'No. The tool only reports. To clean spacing use Whitespace Cleaner, and to normalize headings, lists and references use Markdown Helper, then run the linter again.',
      question: 'Can it fix the problems?',
    },
    {
      answer:
        'The report lists at most 1,000 issues and then says how many there were in total. The JSON output also holds the first 1,000 issues and the full total, so a huge file never freezes the page.',
      question: 'What happens when there are thousands of issues?',
    },
  ],
  help: 'Paste Markdown into the input. Every rule is on by default; untick the ones you do not want in the Rules field. At least one rule must stay selected.\n\nThe report has one line per issue, in the form 12:1 MD009/no-trailing-spaces Trailing spaces [3 spaces]. The first number is the line and the second the column, both counted from 1. Issues are sorted by line, then column, then rule order.\n\nChoose JSON to get an object with the issues, the enabled rules and the total. The other format is always available as a second download. The summary counts the issues, the distinct rules that fired and the lines in the document.\n\nCode blocks, fenced and indented, are skipped by the whitespace rules, and so is front matter. A document over 100,000 UTF-16 units, or one that parses to more than 10,000 tokens, is refused with a message that names the limit.',
  notes: [
    'Processing is local; nothing is uploaded and the Markdown is never changed.',
    'Limits: 100,000 UTF-16 input units, 10,000 parsed tokens and 1,000 listed issues.',
    'MD009 accepts exactly two trailing spaces, because they make a hard line break.',
    'MD010 ignores tabs inside code blocks and inside backtick code spans on one line.',
    'MD022 reports one issue per heading, at its first line, and says whether the blank line is missing above, below or both.',
    'MD047 reports at the last line with content, and the column is just past its last character.',
  ],
};
