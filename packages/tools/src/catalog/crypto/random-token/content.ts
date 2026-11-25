import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A token is a random secret/development credential. Character mode samples uniformly from the combined enabled alphabet.',
        'Byte mode generates random bytes and encodes hex, Base64 or unpadded Base64url. Encoding changes representation, not randomness.',
        'Groups define allowed characters, not a guarantee that every group appears in each token.',
      ],
      title: 'What is a random token?',
    },
    {
      content: [
        'Create development API-key/reset-token fixtures.',
        'Choose Base64url for URL-friendly random bytes.',
        'Match an integration’s byte length and representation.',
      ],
      title: 'When to use Token Generator',
    },
  ],
  examples: [
    'Custom alphabet, Length 32, letters and numbers → 32 characters such as sKTep0Y6i1rmPVGWsQQLqceduBxfYNFV.',
    'Encoded bytes, Bytes 16, Hex → 32 hex characters such as 5c645c81ac15d3fdbe21d0afc9890afd.',
    'Encoded bytes, Bytes 32, Base64url → 43 characters without = padding.',
    'Encoded bytes, Bytes 16, Base64 → 24 characters ending in ==.',
    'Length 12 with only Numbers → 12 digits; a leading 0 is kept.',
    'All four character groups off → error: Enable at least one character group.',
  ],
  faq: [
    {
      answer:
        '32 random bytes (256 bits) is a common choice for API keys and signing secrets, and 16 bytes (128 bits) a usual minimum. In Custom alphabet mode, letters and digits carry about 5.95 bits per character, so 32 characters hold about 190 bits.',
      question: 'How long should an API key or secret be?',
    },
    {
      answer:
        'Yes. Bytes come from crypto.getRandomValues, and characters are picked with rejection sampling so every allowed character is equally likely. Math.random() is never used, and the tool stops if secure randomness is unavailable.',
      question: 'Are the tokens cryptographically secure?',
    },
    {
      answer:
        'Base64url replaces + and / with - and _ and drops the = padding, so the token fits in URLs, file names and cookies without escaping. Base64 keeps the standard alphabet and padding: 16 bytes become 24 characters ending in ==.',
      question: 'What is the difference between Base64 and Base64url?',
    },
    {
      answer:
        'Each character is drawn from all enabled groups combined, so a short token can miss a group by chance. If a service requires one of each, generate again or check the token before using it.',
      question: 'Why doesn’t my token contain a digit or symbol I enabled?',
    },
    {
      answer:
        'The Symbols group adds 23 characters: !@#$%^&*()-_=+[]{};:,.? Quotes, backslash, slash, space, <, >, |, ~ and the backtick are never used.',
      question: 'Which symbols can appear in a token?',
    },
  ],
  help: 'Choose Custom alphabet or Encoded bytes; only active settings are validated.\n\nCount 1…100, character Length 1…512, Bytes 1…256.\n\nEnable at least one group or choose a byte encoding, then run explicitly.\n\nCopy/download random-token.txt intentionally. Settings clear exports without regenerating secrets.',
  notes: [
    'Web Crypto and rejection sampling remove character modulo bias.',
    'Groups are allowed characters, not inclusion requirements.',
    'Short/numeric tokens are easier to guess; choose length for your threat model.',
    'Hex has two characters per byte; Base64 has padding; Base64url omits it.',
    'Invalid active-mode settings fail explicitly; hidden-mode settings are ignored.',
    'Exports contain secrets; clipboard, files and screen sharing can expose them.',
  ],
};
