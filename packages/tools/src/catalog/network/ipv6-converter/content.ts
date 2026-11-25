import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An IPv6 address is 128 bits, usually written as eight groups of four hexadecimal digits separated by colons. RFC 4291 allows several text forms of the same address: leading zeroes may be dropped, one run of zero groups may become ::, and the last 32 bits may be written as a dotted IPv4 address.\n\nRFC 5952 picks one canonical form: lowercase, no leading zeroes, the longest run of two or more zero groups shortened to ::, the first run on a tie, and ::ffff:a.b.c.d for IPv4-mapped addresses.\n\nThis converter reads one address and lists the compressed and expanded forms, hex, decimal integer, binary, the ip6.arpa PTR name and the address type.',
      title: 'What is IPv6 address conversion?',
    },
    {
      content: [
        'Normalize addresses from logs and configuration files before comparing them.',
        'Build the ip6.arpa name for a reverse DNS record.',
        'Recognize documentation, unique local, link-local, multicast, Teredo, 6to4 and NAT64 addresses, and read the IPv4 address they embed.',
        'Turn a 128-bit integer or 32 hex digits from a database back into an address.',
      ],
      title: 'When to convert IPv6',
    },
  ],
  examples: [
    '2001:0db8:0000:0000:0000:ff00:0042:8329 → compressed 2001:db8::ff00:42:8329, type Documentation.',
    '2001:db8:0:0:1:0:0:1 → 2001:db8::1:0:0:1; the first of two equal zero runs becomes ::.',
    '::ffff:c000:0201 → ::ffff:192.0.2.1, IPv4-mapped, with IPv4 192.0.2.1.',
    '[FE80::1%eth0] → fe80::1%eth0, Link-local, zone eth0.',
    '2001:0:4136:e378:8000:63bf:3fff:fdd2 → Teredo server 65.54.227.120, client 192.0.2.45, port 40000.',
    'Integer 281473902969345 → ::ffff:192.0.2.1.',
  ],
  faq: [
    {
      answer:
        'RFC 5952 shortens the longest run of two or more zero groups. When two runs have the same length, the first one becomes ::, and a single zero group is always written as 0.',
      question: 'Which zeros become :: in the compressed form?',
    },
    {
      answer:
        'Yes. Wrap the address in brackets as in a URL, and add a zone such as %eth0 for link-local addresses. The zone is kept in the compressed and expanded forms but left out of the PTR name.',
      question: 'Can I paste an address with brackets or a %zone?',
    },
    {
      answer:
        'No. Enter one address without a /prefix. Use IPv6 Subnet Calculator for network boundaries and prefix sizes.',
      question: 'Does it accept CIDR notation?',
    },
    {
      answer:
        'The type is the most specific match from the IANA special-purpose list: for example 2001:db8::/32 is Documentation, fc00::/7 Unique local, fe80::/10 Link-local and ff00::/8 Multicast with its scope.',
      question: 'How is the address type decided?',
    },
  ],
  help: 'Paste one IPv6 address or apply a sample. Leave Input format on Address for colon notation, or choose 32 hex digits or Integer for a numeric value.\n\nRun the conversion. Malformed input produces an error that names the problem rather than a partially parsed address.\n\nRead the compressed form, the expanded form with all 32 digits, hex, integer, binary in 8 groups of 16 bits, the PTR name and the address type. Mapped, NAT64, 6to4 and Teredo addresses also show the IPv4 address they carry.\n\nCopy or save ipv6-conversion.txt. Use IPv6 Subnet Calculator for prefixes and IPv6 ULA Generator for a new private prefix.',
  notes: [
    'The raw input limit is 128 characters; outer whitespace is ignored.',
    'Address input accepts any RFC 4291 text form in any case: full, ::-compressed or with a dotted IPv4 tail, optionally in brackets and with a %zone of 1 to 64 letters, digits, dots, underscores, tildes or hyphens.',
    'Hex input needs exactly 32 hexadecimal digits with an optional 0x prefix. Integer input is a decimal integer from 0 through 2^128 - 1.',
    'A /prefix, a port, a hostname or a URL is rejected. Use IPv6 Subnet Calculator for CIDR blocks.',
    'The type names a special-purpose block; it does not prove the address is assigned, reachable or routed.',
    'This is local arithmetic: no DNS lookup, ping, network scan or server request is performed.',
  ],
};
