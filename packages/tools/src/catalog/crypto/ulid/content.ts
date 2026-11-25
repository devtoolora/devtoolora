import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'ULID represents 128 bits in 26 Crockford Base32 characters: a 48-bit Unix-millisecond timestamp and 80 random bits.',
        'The alphabet omits I, L, O and U. Canonical values sort by timestamp across different milliseconds.',
        'This generator is non-monotonic: same-millisecond IDs need not follow generation order.',
      ],
      title: 'What is ULID?',
    },
    {
      content: [
        'Create timestamp-oriented IDs for fixtures and development records.',
        'Compare size/ordering with UUID v4.',
        'Use a dedicated monotonic implementation for same-millisecond ordering.',
      ],
      title: 'When to use ULID Generator',
    },
  ],
  examples: [
    'Count 1 → one uppercase 26-character ID such as 01ARZ3NDEKTSV4RRFFQ69G5FAV.',
    'Count 5 within one millisecond → five IDs sharing the first 10 timestamp characters, with random suffixes in no particular order.',
    'IDs from different milliseconds → sorting the strings sorts them by creation time.',
    'Count 0 or 101 → error: Count must be an integer between 1 and 100.',
  ],
  faq: [
    {
      answer:
        'Both hold 128 bits. A ULID starts with a 48-bit millisecond timestamp and is written as 26 Crockford Base32 characters, so IDs sort by creation time; a UUID v4 is 36 characters and random apart from its version bits.',
      question: 'What is the difference between a ULID and a UUID?',
    },
    {
      answer:
        'The first 10 characters encode milliseconds since 1970 in Crockford Base32, and the last 16 are random. This tool does not decode them, but ULID libraries can, for example decodeTime() in the JavaScript ulid package.',
      question: 'How do I read the timestamp in a ULID?',
    },
    {
      answer:
        'Not here. This generator is not monotonic: IDs made in the same millisecond share the timestamp prefix and get independent random suffixes, so their sort order is random. Use a monotonic ULID library when strict order matters.',
      question: 'Are ULIDs from the same millisecond in order?',
    },
    {
      answer:
        'The 80 random bits come from crypto.getRandomValues, the platform’s secure generator. The timestamp is readable by anyone, so a ULID reveals when it was created and should not serve as a secret.',
      question: 'Is the random part of a ULID secure?',
    },
    {
      answer:
        'Crockford Base32 leaves them out to avoid confusion with 1 and 0 and accidental words. Decoders usually accept lowercase and read I and L as 1 and O as 0.',
      question: 'Why are the letters I, L, O and U missing?',
    },
  ],
  help: 'Choose whole Count 1…100.\n\nRun explicitly using the runtime clock and Web Crypto.\n\nSettings clear exports without automatically generating replacements.\n\nCopy/download ulid.txt, one ID per line. The timestamp is visible.',
  notes: [
    'Same-millisecond generation order is not guaranteed.',
    'Clock accuracy/rollback affect ordering.',
    'The timestamp reveals creation time; ULIDs are not authentication secrets.',
    'Collisions remain possible; retain uniqueness constraints.',
    'This tool does not parse, validate or reserve external IDs.',
    'Empty/fractional/out-of-range counts fail without clamping.',
  ],
};
