import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An IPv4 CIDR combines an address with a prefix length: /24 fixes 24 network bits and leaves eight host bits.\n\nThe calculator aligns the supplied address to the containing network and returns masks, inclusive boundaries and a mathematical host range.\n\nOrdinary subnets exclude network and broadcast addresses from the host count. A /31 is treated as a point-to-point pair and a /32 as one host route, neither with a broadcast address.',
      title: 'What is an IPv4 subnet?',
    },
    {
      content: [
        'Review masks or check a host address against a CIDR.',
        'Plan address space and distinguish total addresses from conventional host counts.',
        'Inspect /31 point-to-point addressing and /32 host routes without subtracting nonexistent reserved endpoints.',
      ],
      title: 'When to calculate an IPv4 subnet',
    },
  ],
  examples: [
    '192.168.1.10/24 → network 192.168.1.0/24, mask 255.255.255.0 and 254 conventional hosts.',
    '10.0.0.0/16 → 65536 total addresses, 65534 conventional hosts.',
    '172.16.0.5/30 → network .4, hosts .5–.6, broadcast .7.',
    '203.0.113.10/31 → two point-to-point addresses and no broadcast.',
    '203.0.113.10/32 → one address and no broadcast.',
    '0.0.0.0/0 → all 4294967296 IPv4 values, not all necessarily assignable.',
  ],
  faq: [
    {
      answer:
        '254. A /24 has 256 addresses, and the network (.0) and broadcast (.255) addresses are excluded from hostCount. A /31 counts both of its addresses and a /32 counts one.',
      question: 'How many usable hosts are in a /24?',
    },
    {
      answer:
        'No. Use prefix notation such as 192.168.1.10/24; 192.168.1.10/255.255.255.0 is rejected. The report then gives the matching subnetMask and wildcardMask.',
      question: 'Can I enter a subnet mask instead of a prefix length?',
    },
    {
      answer:
        'It is the bitwise inverse of the subnet mask, as used in some router access lists. For a /24 the subnet mask is 255.255.255.0 and the wildcard mask is 0.0.0.255.',
      question: 'What is a wildcard mask?',
    },
    {
      answer:
        'Host bits are cleared to show the containing network, so 10.1.2.3/8 gives cidr 10.0.0.0/8 while the ip field keeps 10.1.2.3.',
      question: 'Why does the cidr field differ from what I typed?',
    },
    {
      answer:
        'No. The calculator only does arithmetic on the CIDR. Private or reserved ranges, assignments, DHCP leases and reachability are not checked, and nothing is sent over the network.',
      question: 'Does it check whether an address is private or in use?',
    },
  ],
  help: 'Enter dotted decimal followed by /0 through /32, or apply an example. A prefix is required; no default is guessed.\n\nRun the calculation. ip retains the supplied address; cidr and networkAddress show the containing aligned network.\n\nCompare totalAddresses with hostCount. lastAddress always gives the inclusive end; broadcastAddress is null for /31 and /32.\n\nCopy or save ipv4-subnet.json. Use the range expander only for blocks small enough to enumerate completely.',
  notes: [
    'Strict dotted decimal is required. Leading zeroes, extra slashes, fractional prefixes, prefixes above 32 and missing prefixes are rejected.',
    'Host bits are intentionally normalized in cidr: 192.168.1.10/24 describes the same block as 192.168.1.0/24.',
    'subnetMask fixes the network bits; wildcardMask is its 32-bit complement.',
    'Prefixes 0–30 exclude network and broadcast endpoints from firstHost/lastHost. /31 includes both; /32 returns the single IP in both fields.',
    '/31 follows the point-to-point model in RFC 3021. Check device and link support separately.',
    'Counts describe arithmetic, not free or assignable addresses. Special-use ranges, provider reservations and DHCP leases are not inspected.',
    'Input is limited to 128 raw characters. No configuration change, DNS lookup or external request is performed.',
  ],
};
