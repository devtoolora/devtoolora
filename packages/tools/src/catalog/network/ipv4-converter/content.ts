import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'IPv4 is a 32-bit address. Dotted decimal splits those bits into four eight-bit octets, each written as a number from 0 through 255.\n\nThe same bits can be written as one unsigned decimal integer, eight hexadecimal digits or 32 binary digits. These are representations of the same address, not different hosts.\n\nThis converter reads the selected format and returns all four forms. Integers use network byte order: the leftmost octet is the most significant byte.',
      title: 'What is IPv4 conversion?',
    },
    {
      content: [
        'Interpret integer IP fields from a database or diagnostic report.',
        'Compare hexadecimal and binary representations while learning address bits.',
        'Normalize an address for a configuration review without looking up or contacting it.',
      ],
      title: 'When to convert IPv4',
    },
  ],
  examples: [
    '192.168.1.10 → integer 3232235786 and hex 0xc0a8010a.',
    'Integer 3232235786 → 192.168.1.10.',
    'Hex c0a8010a or 0xC0A8010A → 192.168.1.10.',
    'Binary 11000000.10101000.00000001.00001010 → 192.168.1.10.',
    'Binary 10 → 0.0.0.2; decimal integer 10 → 0.0.0.10.',
    '255.255.255.255 → 4294967295, the largest unsigned 32-bit value.',
  ],
  faq: [
    {
      answer:
        'Choose Dotted decimal, enter the address and run. 192.168.1.10 becomes 3232235786, which is 192 × 256³ + 168 × 256² + 1 × 256 + 10 in network byte order.',
      question: 'How do I convert an IP address to an integer?',
    },
    {
      answer:
        'Leading zeroes are ambiguous because some parsers read them as octal. Dotted input must use plain decimal octets from 0 to 255, so write 10.0.0.1 instead.',
      question: 'Why is 010.0.0.1 rejected?',
    },
    {
      answer:
        'No. Integer input is unsigned, from 0 to 4294967295, so -1 and 4294967296 are rejected. For a signed 32-bit database value, add 4294967296 to a negative number first.',
      question: 'Can I convert a negative or signed integer?',
    },
    {
      answer:
        'The selected Input format decides how digits are read: integer 10 is 0.0.0.10, hex 10 is 0.0.0.16 and binary 10 is 0.0.0.2. The format is never guessed from the digits.',
      question: 'Why does 10 give different addresses in different formats?',
    },
    {
      answer:
        'No. Enter one IPv4 address without a /prefix, port or hostname. Use IPv4 Subnet Calculator for CIDR blocks; IPv6 addresses are not supported.',
      question: 'Does it accept CIDR notation or IPv6?',
    },
  ],
  help: 'Paste one address or apply a complete sample. Select the format that actually describes your input.\n\nRun the conversion. Every character must match that format; malformed values produce an error rather than a partially parsed address.\n\nCompare dotted, integer, hex and binary in the JSON report. Hex is padded to eight digits; binary uses four eight-bit groups.\n\nCopy or save ipv4-conversion.json. Use IPv4 Subnet Calculator to inspect network boundaries instead of guessing a prefix.',
  notes: [
    'Dotted input requires four decimal octets from 0–255. Empty octets, leading zeroes, plus signs, hex octets and internal spaces are rejected.',
    'Integer input is unsigned decimal from 0–4294967295, not a signed database integer or little-endian value.',
    'Hex accepts 1–8 case-insensitive digits with an optional 0x or 0X prefix. Binary accepts 1–32 bits with an optional 0b or 0B prefix, or exactly four eight-bit dotted groups.',
    'Outer whitespace is ignored. The raw input limit is 128 characters. CIDR, ports, hostnames, URLs and IPv6 are not accepted here.',
    'A valid representation does not prove the address is assignable, reachable or public. Special-use ranges are not classified.',
    'This is local arithmetic: no DNS lookup, ping, network scan or server request is performed.',
  ],
};
