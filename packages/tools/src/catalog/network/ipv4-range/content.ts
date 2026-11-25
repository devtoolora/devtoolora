import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An IPv4 range is a contiguous sequence of 32-bit addresses. A CIDR identifies an aligned network using an address and a prefix length.\n\nThis tool lists every address between inclusive boundaries in ascending numeric order. CIDR input is aligned to its network even when you enter a host address.\n\nThe list includes network and broadcast boundaries. It is an address list, not a filtered list of usable hosts.',
      title: 'What is IPv4 range expansion?',
    },
    {
      content: [
        'Prepare a small explicit address list for test fixtures or configuration review.',
        'Inspect a small CIDR or a range crossing an octet boundary.',
        'Compare inclusive counts with host counts from IPv4 Subnet Calculator.',
      ],
      title: 'When to expand an IPv4 range',
    },
  ],
  examples: [
    '192.168.1.0/30 → .0 through .3, including both boundaries.',
    '192.168.1.2/30 → the same aligned block, .0 through .3.',
    '192.168.1.10-12 → .10, .11 and .12.',
    '192.168.1.254 - 192.168.2.1 → four addresses crossing an octet boundary.',
    '203.0.113.10/31 → .10 and .11; /32 → one address.',
    '10.0.0.0/22 contains exactly 1024 addresses and is accepted; /21 fails without truncation.',
  ],
  faq: [
    {
      answer:
        'Up to 1024 addresses per run, such as a full /22. A larger range, such as a /21, is rejected with an error instead of returning a partial list.',
      question: 'How many addresses can I expand at once?',
    },
    {
      answer:
        'Yes. Every address between the boundaries is listed, so 192.168.1.0/30 returns .0, .1, .2 and .3. Use IPv4 Subnet Calculator to see the usable host range.',
      question: 'Are the network and broadcast addresses included?',
    },
    {
      answer:
        'One address (10.0.0.5), a CIDR (192.168.1.0/30), a full range (10.0.0.1 - 10.0.0.3) or a final-octet shorthand (192.168.1.10-12). Spaces around the single hyphen are allowed.',
      question: 'Which range formats can I enter?',
    },
    {
      answer:
        'CIDR input is aligned to its network boundary, so any address inside the /30 expands to the same block, .0 through .3. Use a hyphen range to start at an exact address.',
      question: 'Why does 192.168.1.2/30 start at 192.168.1.0?',
    },
    {
      answer:
        'No. The end must not be lower than the start, so 192.168.1.12-10 is rejected rather than reordered. The output is always in ascending order.',
      question: 'Can I list a range in reverse order?',
    },
  ],
  help: 'Enter one IPv4 address, address/prefix, start-end or start-finalOctet. Apply a sample to see each syntax.\n\nRun the expansion. CIDR aligns to its network boundary; a hyphen range uses your exact endpoints.\n\nReview the inclusive list and count in the summary. Network and broadcast addresses are not removed.\n\nCopy or save ipv4-range.txt. Use the subnet calculator for larger blocks rather than trying to enumerate them.',
  notes: [
    'IPv4 octets use strict decimal notation without leading zeroes. CIDR prefixes are integers from 0–32; missing or malformed prefixes are not guessed.',
    'A shorthand endpoint changes only the final octet. Use a full endpoint to cross into another /24.',
    'Endpoints are inclusive. Reversed ranges are rejected, not reordered.',
    'At most 1024 addresses are returned. Requests for 1025 or more fail without a partial list.',
    'Both /31 addresses and the single /32 address are included. Other blocks also include network and broadcast boundaries.',
    'The raw input limit is 128 characters. Outer whitespace and spaces around a single hyphen are allowed; internal address whitespace is not.',
    'No address is contacted, scanned or assigned. An address list does not grant permission to probe a network.',
  ],
};
