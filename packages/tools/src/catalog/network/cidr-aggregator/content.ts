import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'CIDR aggregation (also called route summarization or supernetting) replaces a list of addresses and blocks with the smallest set of CIDRs that covers exactly the same addresses. 10.0.0.0/24 and 10.0.1.0/24 together become 10.0.0.0/23.\n\nThis tool reads one address, CIDR or inclusive start - end range per line, for IPv4 and IPv6. It joins overlapping and adjacent ranges, then splits each result into the largest aligned blocks, IPv4 first and each family in ascending order.\n\nThe overlaps report lists every pair of input lines whose ranges intersect, saying whether one line contains the other or the two only partly overlap.',
      title: 'What is CIDR aggregation?',
    },
    {
      content: [
        'Shorten a firewall allowlist, security group or route table without changing what it matches.',
        'Turn an arbitrary start - end range into the CIDR blocks a configuration file accepts.',
        'Find duplicate or nested entries in an IP allowlist before reviewing it.',
        'Check that planned subnets do not collide with each other.',
      ],
      title: 'When to aggregate or check CIDRs',
    },
  ],
  examples: [
    '10.0.0.0/24, 10.0.1.0/24 and 10.0.1.128/25 → 10.0.0.0/23.',
    '10.0.0.1 - 10.0.0.6 → 10.0.0.1/32, 10.0.0.2/31, 10.0.0.4/31 and 10.0.0.6/32.',
    '2001:db8::-2001:db8::ff → 2001:db8::/120.',
    '10.0.0.5/24 → 10.0.0.0/24, because host bits are cleared.',
    '0.0.0.0/0, ::/0 and 192.168.0.0/16 → 0.0.0.0/0 and ::/0.',
    '10.0.0.0/24, 10.0.0.128/25 and 10.0.0.100-10.0.1.5 → line 1 contains line 2, line 1 overlaps line 3, line 3 contains line 2.',
  ],
  faq: [
    {
      answer:
        'One per line: a single IPv4 or IPv6 address, a CIDR such as 10.0.0.0/8 or 2001:db8::/32, or an inclusive range start - end of two full addresses of the same family. Blank lines and lines starting with # are skipped.',
      question: 'What can each line contain?',
    },
    {
      answer:
        'No. Any other line stops the run with an error naming its line number, because a merge that silently dropped a line would cover fewer addresses than you entered.',
      question: 'Are invalid lines skipped?',
    },
    {
      answer:
        'A line contains another when its range covers the other completely; identical ranges name the earlier line as the container. Otherwise the two lines overlap partly, and the earlier line is named first.',
      question: 'What is the difference between contains and overlaps?',
    },
    {
      answer:
        'Only the first 1,000 pairs found are listed, and the summary says more than 1,000 overlapping pairs. The merged CIDR list is always complete.',
      question: 'What happens when there are many overlaps?',
    },
  ],
  help: 'Paste one IPv4 or IPv6 address, CIDR or start - end range per line, or apply a sample. Lines starting with # and blank lines are ignored.\n\nChoose Merged CIDRs to get the minimal CIDR list covering every input, or Overlaps to list the pairs of input lines that intersect.\n\nRun the tool. The summary counts the inputs, the merged CIDRs and the overlapping pairs; an invalid line stops the run with its line number.\n\nCopy or save cidr-aggregator.txt. Use IPv4 Subnet Calculator or IPv6 Subnet Calculator to inspect one block, and IPv4 Range Expander to list its addresses.',
  notes: [
    'The input limit is 10,000 lines of at most 128 characters each, counting blank and comment lines.',
    'At most 1,000 overlapping pairs are reported; the summary says more than 1,000 overlapping pairs when the list is cut.',
    'A CIDR with host bits set, such as 10.0.0.5/24, is read as its network 10.0.0.0/24.',
    'A range is inclusive, written start - end with full addresses of one family; the end must not be before the start.',
    'IPv4 and IPv6 are merged separately; IPv4 blocks are listed first and each family is sorted by address. IPv6 zones are not accepted.',
    'The merged list is capped at 100,000 CIDRs; a longer result stops the run with an error.',
    'Adjacent and overlapping ranges are joined; the merged list covers exactly the input addresses, never more.',
    'This is local arithmetic: no DNS lookup, routing check, registry query or server request is performed.',
  ],
};
