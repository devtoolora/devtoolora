import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Email normalization proposes a consistent spelling, not proof that two addresses belong to one person. Domains are case-insensitive; generic local parts can be case-sensitive and are preserved here.',
        'For gmail.com and legacy googlemail.com only, this tool proposes a lowercased, dot-free username without its + tag and maps googlemail.com to gmail.com. It does not apply Gmail rules to custom Workspace domains.',
        'Only common ASCII dot-atom addresses are supported. Quoted local parts, display-name syntax, domain literals and internationalized mailboxes are outside this tool.',
      ],
      title: 'What is email normalization?',
    },
    {
      content: [
        'Inspect how an explicit provider-specific alias rule changes a development example.',
        'Lowercase a domain without changing a generic local-part identifier.',
        'Review a suggested canonical address; never merge authentication accounts solely from this result.',
      ],
      title: 'When to use Email Normalizer',
    },
  ],
  examples: [
    'Ada.Lovelace+demo@gmail.com → adalovelace@gmail.com, hasPlusAlias true.',
    'Ada.Lovelace+demo@Example.com → Ada.Lovelace+demo@example.com; only the domain is lowercased.',
    'a.b@custom-workspace.example → a.b@custom-workspace.example, with the dot kept.',
    'Ada@googlemail.com → ada@gmail.com.',
    '"  Ada@Example.com  " → original "Ada@Example.com", normalized "Ada@example.com".',
    'a..b@example.com → error; mailbox delivery and ownership are never checked.',
  ],
  faq: [
    {
      answer:
        'Yes for Gmail: ada.lovelace+news@gmail.com and adalovelace@gmail.com reach the same inbox, so the tool removes dots and the +tag and lowercases the name. It applies this rule only to gmail.com and googlemail.com.',
      question: 'Does Gmail ignore dots and plus tags?',
    },
    {
      answer:
        'No. There is no DNS, MX or SMTP check and nothing is sent. The tool checks a conservative ASCII syntax and suggests a spelling; only a confirmation email proves that an address works.',
      question: 'Does it check whether the address exists?',
    },
    {
      answer:
        'Other providers and custom domains set their own alias rules, and some treat dots or + as part of the name. Outside Gmail the local part is kept exactly: only the domain is lowercased, and hasPlusAlias reports the +.',
      question: 'Why are plus tags kept for Outlook or my own domain?',
    },
    {
      answer:
        'Not on its own. Two spellings that normalize to the same Gmail address reach one inbox, but that does not prove they are the same account holder in your system. Use it to flag likely duplicates and confirm ownership with email verification.',
      question: 'Should I merge user accounts by the normalized address?',
    },
    {
      answer:
        'Only common ASCII dot-atom addresses are supported. Quoted local parts, display names such as Ada <ada@example.com>, IP-literal domains and internationalized addresses are rejected rather than half-parsed.',
      question: 'Why is my address with quotes or accents rejected?',
    },
  ],
  help: 'Enter one ASCII email address without a display name.\n\nRun normalization and compare original with normalized.\n\nRead the domain and hasPlusAlias fields; generic + tags remain untouched.\n\nCopy or download the JSON report only after reviewing the provider-specific assumptions.',
  notes: [
    'Raw input is at most 1,024 UTF-16 characters; trimmed address is at most 254 ASCII characters and local part at most 64.',
    'Domain labels must be 1–63 ASCII letters/digits/hyphens and cannot begin or end with a hyphen.',
    'This is a conservative supported syntax, not full RFC mailbox validation.',
    'No DNS/MX check, SMTP request, provider lookup, delivery guarantee or ownership verification occurs.',
    'Gmail normalization is a suggestion, not a universal identity key; do not use it to merge security principals.',
    'Both original and normalized addresses contain personal data in the report/export.',
    'Dots, case and plus signs in other providers may have different semantics and are preserved.',
  ],
};
