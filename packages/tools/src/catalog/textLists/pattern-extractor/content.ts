import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Pattern extraction pulls structured values such as emails, links, addresses and numbers out of unstructured text and returns them as a clean list, one per line.',
        'Pick a built-in pattern or write your own JavaScript regular expression. With a custom pattern, the first capture group is extracted when it exists, otherwise the whole match. Everything runs locally in your browser or editor.',
      ],
      title: 'What is a pattern extractor?',
    },
    {
      content: [
        'Collect every email address from a signature block, thread or export.',
        'List the URLs or IP addresses that appear in a log or a Markdown file.',
        'Pull numbers with units, ids or tags out of free text with a custom group such as (\\d+)px.',
        'Count how many matches exist and how many are unique before cleaning data.',
      ],
      title: 'When to use Pattern Extractor',
    },
  ],
  examples: [
    'Emails: "Mail a@x.io or b@y.org, then a@x.io again" → a@x.io and b@y.org.',
    'URLs: "see https://a.io/x) and http://b.io" → https://a.io/x and http://b.io.',
    'URLs: "See https://a.io/x." → https://a.io/x, without the final dot.',
    'Numbers: "2024-01-15 1,234,567" → 2024, 01, 15 and 1,234,567.',
    'IPv4: "10.0.0.1 999.1.1.1 192.168.1.10" → 10.0.0.1 and 192.168.1.10.',
    'Custom group: (\\d+)px on "w 12px h 7px" → 12 and 7.',
    'Hashtags with Sort matches: "#Dev #dev" → #Dev then #dev.',
  ],
  faq: [
    {
      answer:
        'Candidates made of hex groups and colons are kept only if they are a valid RFC 4291 text form, including compressed ones such as ::1 or 2001:db8::1. Time strings like 12:30:45 are rejected. Embedded IPv4 (::ffff:1.2.3.4) and zone ids (%eth0) are not extracted.',
      question: 'Which IPv6 forms are extracted?',
    },
    {
      answer:
        'Wrap the part you want in parentheses, for example (\\d+)px. When the pattern has a capture group, only the first group is returned; without one, the whole match is returned.',
      question: 'How do I extract only part of a match?',
    },
    {
      answer:
        'Each run uses a separate worker that is stopped after 2 seconds. A pattern with catastrophic backtracking ends with a time-limit error and no partial result, and the next run starts fresh.',
      question: 'What happens when a pattern takes more than 2 seconds?',
    },
    {
      answer:
        'The email pattern is a practical shape check for addresses in running text. It skips quoted local parts, comments and internationalized domains on purpose, so rare but valid addresses may be missed.',
      question: 'Why does the email pattern not cover every valid address?',
    },
  ],
  help: 'Paste text or choose a sample, then pick what to extract.\n\nBuilt-in patterns cover emails, URLs, IPv4 and IPv6 addresses, numbers and hashtags. Choose Custom regex to write your own pattern; Ignore case applies only to custom patterns.\n\nRemove duplicates keeps the first occurrence of every match. Sort matches orders the result by Unicode code point, so uppercase letters come before lowercase ones.\n\nThe summary shows the total number of matches and how many are unique, even when duplicates are kept.\n\nCopy the result, insert it into the editor, or save matches.txt.',
  notes: [
    'Input is limited to 200,000 UTF-16 units and 50,000 matches. Reaching the match limit stops with an error instead of returning a partial list.',
    'A custom pattern must be 1 to 256 characters and is compiled with the g and u flags (plus i with Ignore case). Invalid patterns are reported with the engine message.',
    'Each run uses a separate worker stopped after 2 seconds, so a catastrophic pattern ends with a time-limit error instead of freezing the app.',
    'IPv6 extraction supports full and compressed forms and rejects time-like strings; embedded IPv4 and zone ids are not extracted. The number pattern accepts a dot or a comma as the decimal separator, keeps 1,234,567, 1,000.50 and 1.000,50 whole, and reads a hyphen after a letter or digit as a separator, not a minus sign.',
    'URLs may be in any letter case. Trailing punctuation such as . , : ! ? ; is left out, as in GFM autolinks, and balanced parentheses and brackets are kept.',
    'Empty matches are skipped. Sorting uses code points, not locale rules.',
  ],
};
