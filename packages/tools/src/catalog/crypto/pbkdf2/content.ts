import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'PBKDF2 (RFC 8018) turns a password into a fixed-length key by running an HMAC over the password and a salt thousands of times. The repetition makes every password guess expensive, which is what slows down brute-force attacks.',
        'You choose the hash (SHA-1, SHA-256, SHA-384 or SHA-512), the salt, the iteration count and the key length in bytes. The same inputs always give the same key, so the result can be reproduced in any PBKDF2 implementation.',
        'The tool runs locally with the Web Crypto API. The password is never uploaded or saved in drafts.',
      ],
      title: 'What is PBKDF2 Key Derivation?',
    },
    {
      content: [
        'Check that your application derives the same key as a reference value or a test vector.',
        'Pick an iteration count and see whether it meets the current OWASP floor for the chosen hash.',
        'Generate a key for a quick experiment. For storing user passwords prefer a memory-hard function such as Argon2id or scrypt where available.',
      ],
      title: 'When to use PBKDF2 Key Derivation',
    },
  ],
  examples: [
    'password "password", salt "salt", SHA-1, 1 iteration, 20 bytes → 0c60c80f961f0e71f3a9b524af6012062fe037a6 (RFC 6070).',
    'The same inputs with 4,096 iterations → 4b007901b765489abead49d926f721d065a429c1.',
    'SHA-256 with 600,000 iterations and a 32-byte key → a 64-character hex key and no findings.',
    'Set 1,000 iterations with SHA-256 → a finding that it is below the OWASP floor of 600,000.',
    'Leave the salt empty → a finding that the salt is empty.',
    'Choose Base64 output with a 64-byte key → an 88-character Base64 string.',
  ],
  faq: [
    {
      answer:
        'OWASP lists 1,400,000 for SHA-1, 600,000 for SHA-256 and 220,000 for SHA-512 (checked November 2026). It lists no SHA-384 value, so the tool applies the SHA-512 floor there. The tool flags anything below the floor of the chosen hash.',
      question: 'How many iterations should I use?',
    },
    {
      answer:
        'The salt makes each derived key unique even for identical passwords, which defeats precomputed tables. Use at least 16 random bytes per password and store it next to the result.',
      question: 'Why does PBKDF2 need a salt?',
    },
    {
      answer:
        'The salt field is read as UTF-8 text, hex digits or Base64 depending on the chosen salt encoding. Pick the encoding that matches how your application stores the salt bytes.',
      question: 'How is the salt interpreted?',
    },
    {
      answer:
        'No. The password is used to derive the key in your browser and discarded. It is a password field, so it is excluded from saved drafts and never shown in the summary.',
      question: 'Is my password stored or sent anywhere?',
    },
  ],
  help: 'Enter a password and a salt, and pick how the salt is encoded.\n\nChoose the hash, the iteration count and the key length in bytes.\n\nPick the output encoding and run the tool.\n\nCopy or save the key. The summary lists weak settings such as too few iterations or an empty salt.',
  notes: [
    'The password is at most 1,024 characters and is encoded as UTF-8 without normalization.',
    'Iterations range from 1 to 10,000,000 and the key length from 1 to 512 bytes.',
    'The floors are the OWASP values 1,400,000 (SHA-1), 600,000 (SHA-256) and 220,000 (SHA-512); SHA-384 has no OWASP value and takes the SHA-512 floor.',
    'Hex salt must be an even number of hex digits; whitespace is ignored. Base64 salt accepts standard Base64.',
    'An empty salt is allowed but reported as a finding, because it makes keys identical for identical passwords.',
    'Output is hex, Base64 or Base64URL. Derived keys longer than the hash length repeat the HMAC blocks, so the key is not stronger than the password.',
    'The tool does not run automatically: high iteration counts take noticeable time, so press Run.',
  ],
};
