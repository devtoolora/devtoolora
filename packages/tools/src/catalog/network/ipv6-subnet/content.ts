import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An IPv6 prefix such as 2001:db8::/32 names a block of addresses: the first 32 bits are fixed and the remaining 96 bits are free. A /48 is the usual site allocation, and a /64 is the standard size of one subnet.\n\nUnlike IPv4, IPv6 has no broadcast address. Every address in the block, including the first and the last, can be assigned to an interface; the first one is reserved as the subnet-router anycast address (RFC 4291).\n\nThis calculator reads address/prefix and lists the network, prefix mask, first and last address, the exact number of addresses and how many /64 networks fit in the block. It can also split the block into longer prefixes.',
      title: 'What is an IPv6 subnet?',
    },
    {
      content: [
        'Plan how to carve a /48 or /56 allocation into /64 subnets.',
        'Check the first and last address of a prefix before writing firewall rules or ACLs.',
        'Normalize a prefix with host bits set to its network address.',
        'Size an allocation: how many addresses or /64 networks a prefix holds.',
      ],
      title: 'When to calculate IPv6 subnets',
    },
  ],
  examples: [
    '2001:db8:abcd:12::/48 → network 2001:db8:abcd::/48, host bits ignored, 2^80 addresses.',
    '2001:db8::/62 split into 64 → four subnets from 2001:db8::/64 to 2001:db8:0:3::/64.',
    '2001:db8::/32 split into /56 → 16777216 subnets, the first 1,024 listed.',
    'fd00:1234:5678::/48 → a unique local site prefix with 65536 /64 networks.',
    '2001:db8::1/128 → a single address; the /64 networks row is omitted.',
    '::/0 → the whole IPv6 space, 2^128 addresses.',
  ],
  faq: [
    {
      answer:
        'No. IPv6 replaced broadcast with multicast, so every address in the block is assignable. The first address is the subnet-router anycast address and is normally left to routers.',
      question: 'Does IPv6 have a broadcast address?',
    },
    {
      answer:
        'A /64 is the standard subnet size. SLAAC and many other features assume a 64-bit interface identifier, so hosts are usually placed on /64 networks and larger blocks are split into them.',
      question: 'Why is /64 the usual subnet size?',
    },
    {
      answer:
        'Enter a longer prefix as 64 or /64. It must be between the input prefix and /128. Up to 1,024 subnets are listed and the summary reports the full count when there are more.',
      question: 'How does the split prefix work?',
    },
    {
      answer:
        'Yes. Bits after the prefix are cleared to find the network address, and the summary says host bits ignored so you can see that the input was not a network address.',
      question: 'What if the address has host bits set?',
    },
  ],
  help: 'Enter an IPv6 address with a prefix length such as 2001:db8::/48, or apply a sample. A plain address without /prefix is rejected.\n\nOptionally set Split into prefix to list subnets, for example 64 or /64. It must be the input prefix or longer, up to /128.\n\nRun the calculation. Read the network, prefix length, mask, first and last address, the exact address count and the number of /64 networks. The summary notes ignored host bits and truncated subnet lists.\n\nCopy or save ipv6-subnet.txt. Use IPv6 Address Converter for a single address and IPv6 ULA Generator to create a private prefix.',
  notes: [
    'The raw input limit is 128 characters; outer whitespace is ignored.',
    'The prefix must be a whole number from 0-128. The address may be in any RFC 4291 text form, but zones, brackets and ports are not accepted here.',
    'The split prefix runs from the input prefix through /128, written as 64 or /64.',
    'At most 1,024 subnets are listed; the summary and heading state the full count when there are more.',
    'IPv6 has no broadcast address: every address is assignable, and the first address is the subnet-router anycast address.',
    'This is local arithmetic: no DNS lookup, routing check, allocation registry query or server request is performed.',
  ],
};
