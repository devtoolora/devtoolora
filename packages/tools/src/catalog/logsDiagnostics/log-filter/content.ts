import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A line filter retains each source line matching Include and not matching Exclude. Either pattern may be blank, but at least one is required.',
        'Patterns use JavaScript regex syntax without surrounding / delimiters. Matching runs independently for each line; it cannot match across line boundaries.',
        'The application runs custom regex in an isolated worker with a two-second execution limit, so a pathological pattern can be stopped and replaced.',
      ],
      title: 'What is line-based log filtering?',
    },
    {
      content: [
        'Keep errors or warnings while excluding known noisy events.',
        'Select a request identifier or anchored severity marker.',
        'Use Regex Tester for captures and Raw Log Redactor before sharing filtered output.',
      ],
      title: 'When to use Log Filter',
    },
  ],
  examples: [
    'Include error|warn with flags i → keeps ERROR and WARN lines.',
    'Include error, Exclude healthcheck → keeps ERROR database timeout and drops ERROR healthcheck failed.',
    'Include ^ERROR on ERROR demo and INFO contains ERROR → ERROR demo only.',
    'Empty Include, Exclude DEBUG → every line except DEBUG lines.',
    'Include v1\\.2 → matches v1.2 but not v1x2; plain . matches any character.',
    'Include ERROR on INFO demo → an empty result, not an error.',
  ],
  faq: [
    {
      answer:
        'Enter error|warn in Include pattern, healthcheck in Exclude pattern and keep Flags as i. A line is kept only when it matches Include and does not match Exclude.',
      question: 'How do I keep errors but drop health checks?',
    },
    {
      answer:
        'No. Enter the bare regular expression, such as error|warn. Slashes are treated as literal characters, so /error/ only matches lines that contain the slashes.',
      question: 'Do I wrap the pattern in slashes like /error/?',
    },
    {
      answer:
        'Not by default, because Flags starts as i. Clear the Flags field for case-sensitive matching, so warn no longer matches WARN.',
      question: 'Is matching case-sensitive?',
    },
    {
      answer:
        'No. Each line is tested on its own, so a pattern containing \\n never matches. Use Regex Tester for patterns that span several lines.',
      question: 'Can a pattern match across several lines?',
    },
    {
      answer:
        'Global and sticky regexes keep state between tests, which can skip matching lines. Only the flags d, i, m, s, u and v are accepted, each at most once, and u cannot be combined with v.',
      question: 'Why is the g flag rejected?',
    },
  ],
  help: 'Paste log lines and enter Include and/or Exclude.\n\nChoose unique flags such as i for case-insensitive matching.\n\nRun filtering; invalid flags or patterns produce an error.\n\nReview the matched-line count and copy or download the exact retained text.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters. No network requests or execution of log contents occur.',
    'Reports and transformed logs may still contain names, paths, identifiers or personal data. Review before copying or sharing.',
    'Unique flags d, i, m, s, u and v are accepted; g and y are rejected to avoid stateful line matching. u and v cannot be combined.',
    'Each regex is at most 1,000 characters. Flags are never silently removed or deduplicated.',
    'CRLF and CR are normalized to LF; ordering and retained line contents are preserved.',
    'The two-second limit applies to the app worker, not direct synchronous use of the shared function API.',
    'Filtering is not redaction. Retained lines still contain all of their original values.',
  ],
};
