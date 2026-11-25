import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'UUID is a 128-bit identifier written as 32 hex digits and four hyphens.',
        'Version 4 uses random bits with fixed version/variant bits. This generator uses Web Crypto and lowercase canonical formatting.',
        'UUID v4 is not time ordered or an authorization mechanism.',
      ],
      title: 'What is UUID v4?',
    },
    {
      content: [
        'Create fixture IDs without coordinating a counter.',
        'Copy canonical IDs into database/request fixtures.',
        'Choose ULID when timestamp ordering is useful.',
      ],
      title: 'When to use UUID Generator',
    },
  ],
  examples: [
    'Count 1 → one lowercase ID such as 1fba3afb-e04a-401e-a29d-96ec3b11d5d6.',
    'Count 5 → five IDs, one per line, not a JSON array.',
    'Any generated ID → the third group starts with 4 and the fourth with 8, 9, a or b.',
    'Count 0 or 101 → error: Count must be an integer between 1 and 100.',
  ],
  faq: [
    {
      answer:
        'Only version 4, the random kind. Time-based v1 and v7 and name-based v3 and v5 are not available; use ULID Generator when you want IDs that sort by creation time.',
      question: 'Which UUID versions can it generate?',
    },
    {
      answer:
        'Yes. The 16 bytes come from crypto.getRandomValues, the platform’s cryptographically secure generator, before the version and variant bits are set. If Web Crypto is unavailable the tool fails instead of using a weaker source.',
      question: 'Are the UUIDs cryptographically random?',
    },
    {
      answer:
        'In theory, but with 122 random bits you would need about 2.7 × 10^18 IDs for a 50% chance of a single collision. Keep a unique constraint in your database anyway.',
      question: 'Can two UUID v4 values collide?',
    },
    {
      answer:
        'The generator writes the lowercase, hyphenated form. UUIDs are not case-sensitive, so uppercasing them with Case Converter’s UPPER CASE mode gives the same value, as long as the system you paste into accepts that spelling.',
      question: 'Can I get uppercase UUIDs?',
    },
    {
      answer:
        'They are hard to guess, but UUIDs are designed as identifiers and often end up in logs and URLs. For API keys and reset links, use Token Generator with 32 random bytes instead.',
      question: 'Can I use a UUID as a secret token?',
    },
  ],
  help: 'Choose whole Count 1…100.\n\nRun explicitly for fresh values; run again for another batch.\n\nSettings clear exports without automatically generating replacements.\n\nCopy/download uuid.txt, one ID per line without a trailing newline.',
  notes: [
    'Only v4 is generated, not v1/v5/v7.',
    'Web Crypto randomness has no Math.random() fallback.',
    'Fixed version/variant bits leave 122 random bits.',
    'Collisions are possible; retain uniqueness constraints.',
    'IDs are not reserved or an access-control mechanism.',
    'Empty/fractional/out-of-range counts fail without clamping.',
  ],
};
