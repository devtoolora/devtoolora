import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Bcrypt is a password hashing function built on the Blowfish cipher. It mixes a random 128-bit salt and a cost factor into the hash, so the same password gives a different hash every time and every guess costs the attacker real CPU time.',
        'A bcrypt hash is one string such as $2b$10$ followed by 22 salt characters and 31 hash characters. It carries the version, the cost and the salt, so verifying needs only the password and that string.',
        'The tool runs locally with bcryptjs. The password is never uploaded or saved in drafts.',
      ],
      title: 'What is Bcrypt Hash & Verify?',
    },
    {
      content: [
        'Create a hash to seed a test database or a fixture.',
        'Check whether a password matches a hash taken from a user table or a config file.',
        'Compare how long different cost values take before choosing one for your application.',
      ],
      title: 'When to use Bcrypt Hash & Verify',
    },
  ],
  examples: [
    'Hash "correct horse battery staple" at cost 10 → a 60-character $2b$10$ hash and "Cost 10 · 2^10 rounds · took 81 ms".',
    'Hash the same password twice → two different hashes, because each run uses a new salt.',
    'Verify "U*U" against $2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW → Match.',
    'Verify "U*V" against the same hash → No match.',
    'Verify " a" against a hash of "a" → No match, because spaces are part of the password.',
    'Hash a 37-character password of "é" → an error that it is 74 bytes, above the 72-byte limit.',
  ],
  faq: [
    {
      answer:
        'Each hash costs 2^cost rounds, so every step doubles the time. A cost of 10 takes roughly 80 ms on a laptop and 12 about 300 ms. Pick the highest value your login path can afford, and not below 10.',
      question: 'Which cost should I use?',
    },
    {
      answer:
        'Bcrypt reads at most 72 bytes of the password and ignores the rest, so two long passwords with the same first 72 bytes would match. The tool refuses longer passwords; pre-hash them first if you need them.',
      question: 'Why is there a 72-byte limit?',
    },
    {
      answer:
        'Every hash gets a fresh random salt, so the output changes on each run. That is why the tool does not run automatically; use Verify to check a password against a hash.',
      question: 'Why does the hash change every time?',
    },
    {
      answer:
        'A high cost blocks the shared worker while it runs, so the next run in the same editor waits until the hash finishes. Cost 14 can take more than a second.',
      question: 'Why is the tool slow at a high cost?',
    },
    {
      answer:
        'No. The password is hashed in your browser and discarded. It is a password field, so it is excluded from saved drafts.',
      question: 'Is my password stored or sent anywhere?',
    },
  ],
  help: 'Choose Hash or Verify.\n\nEnter the password. In Hash mode pick a cost between 4 and 14; in Verify mode paste the bcrypt hash.\n\nPress Run. A hash can take a moment at a high cost.\n\nCopy or save the hash, or read Match or No match.',
  notes: [
    'Hash output always starts with $2b$. Verify accepts $2a$, $2b$ and $2y$ hashes; other prefixes such as $2x$ are errors.',
    'The cost is an integer from 4 to 14. A hash with a cost outside that range is rejected before any work, so a hostile hash cannot block the worker.',
    'The password is used exactly as typed: spaces are kept and nothing is trimmed or normalized.',
    'Only the first 72 UTF-8 bytes count in bcrypt, so longer passwords are rejected instead of silently cut. A character such as é takes 2 bytes.',
    'An empty password gives "Password is empty."',
    'The tool does not run automatically because the output is random and a high cost takes time. Press Run.',
    'A malformed hash gives the expected shape: $2b$10$ followed by 53 characters of [./A-Za-z0-9].',
  ],
};
