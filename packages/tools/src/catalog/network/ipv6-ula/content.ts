import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Unique Local IPv6 Addresses provide address space for local networks and private interconnections. They are not intended for public Internet routing.\n\nThe locally assigned form starts with fd and a random 40-bit Global ID. Together they form a /48 site prefix; the next 16 bits allow up to 65536 /64 subnets.\n\nThis generator draws five secure random bytes, places them after fd and groups the complete 48 bits into three IPv6 hextets. Its report illustrates a subnet and host from that same generated site.',
      title: 'What is an IPv6 ULA prefix?',
    },
    {
      content: [
        'Plan stable local addressing for a lab, home network or private site.',
        'Reduce the likelihood of overlapping site/VPN prefixes.',
        'Understand /48 site allocations, /64 subnets and full host addresses before configuring a router.',
      ],
      title: 'When to generate IPv6 ULA',
    },
  ],
  examples: [
    'Illustrative site: fd12:3456:789a::/48. Do not deploy this shared documentation example.',
    'Subnet ID 0001: fd12:3456:789a:1::/64.',
    'Illustrative host: fd12:3456:789a:1::1.',
    'Global ID 123456789a has ten hex digits (40 bits) after fd.',
    'A /48 allows 65536 /64 subnet IDs from 0000 through ffff.',
    'Generate and record one site prefix, then allocate stable subnet IDs rather than regenerating the site for every subnet.',
  ],
  faq: [
    {
      answer:
        'An address from fc00::/7 for private networks, similar in purpose to IPv4’s 10.0.0.0/8. Locally assigned prefixes start with fd followed by a random 40-bit Global ID, which together form a /48 for one site.',
      question: 'What is an IPv6 Unique Local Address?',
    },
    {
      answer:
        'A random ID makes it unlikely that two sites choose the same prefix, so networks can later be joined over a VPN or merged without renumbering. Hand-picked values such as fd00::/48 collide easily.',
      question: 'Why should the Global ID be random?',
    },
    {
      answer:
        '65536 /64 subnets, numbered by the fourth hextet from 0000 to ffff. The planning report shows subnet 1 and host ::1 from the same generated prefix as an example.',
      question: 'How many subnets does a /48 ULA prefix provide?',
    },
    {
      answer:
        'No. ULA prefixes are meant for local networks and private links and should not be advertised on the public internet. Hosts usually keep a global address alongside the ULA for internet traffic.',
      question: 'Can ULA addresses be routed on the internet?',
    },
    {
      answer:
        'No. The tool only prints a candidate prefix from secure random bytes; it does not check any registry or your network. Record the prefix you choose and keep it stable, because every run generates a new one.',
      question: 'Does generating a prefix configure my router?',
    },
  ],
  help: 'Choose Site prefix for a directly copyable /48, or Planning report for JSON explaining the generated site.\n\nRun explicitly to generate a candidate. Opening the tool or changing display mode does not allocate a new prefix.\n\nCompare prefix, exampleSubnet and exampleHost in the report. They are coherent examples, not configured interfaces.\n\nCopy or save the result and record a chosen prefix for reuse. Review existing site and VPN prefixes before deploying it.',
  notes: [
    'The address layout follows RFC 4193: fd + 40 random bits = /48. This implementation uses secure random bytes, not the RFC’s illustrative NTP/EUI-64/SHA-1 procedure.',
    'The first hextet is fdxx, not fd followed by four more digits. No IPv6 hextet exceeds four hex digits.',
    'A /48 is a site allocation, not an interface address. exampleSubnet and exampleHost use subnet ID 1; no device is configured.',
    'Global IDs are random, not guaranteed unique. No central registry or existing network is queried.',
    'ULA is not public Internet address space and is not automatically secure. Routing, firewall and DNS policy remain separate.',
    'Secure crypto.getRandomValues is required, with no Math.random fallback or user-provided seed.',
    'Every explicit run generates a new candidate. Keep deployed prefixes stable; changing mode and running again does not preserve an older candidate.',
    'Output is lowercase with three full four-digit hextets before ::/48. Documentation examples must not be copied as supposedly unique allocations.',
  ],
};
