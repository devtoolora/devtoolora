import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Argon2 is a memory-hard password hashing function and the winner of the Password Hashing Competition. Every hash needs a set amount of memory and several passes over it, so an attacker with GPUs or custom hardware pays for memory as well as for compute.',
        'Argon2id is the recommended variant: it resists both side-channel and GPU attacks. Argon2i is tuned against side channels and Argon2d against GPU cracking. The defaults here are the first Argon2id setting in the OWASP Password Storage Cheat Sheet: 19 MiB, 2 passes, 1 lane.',
        'A hash is one PHC string such as $argon2id$v=19$m=19456,t=2,p=1$ followed by the Base64 salt and hash. It carries the variant, version, parameters and salt, so verifying needs only the password and that string.',
        'The tool runs locally with @noble/hashes. The password is never uploaded or saved in drafts.',
      ],
      title: 'What is Argon2 Hash & Verify?',
    },
    {
      content: [
        'Create a hash to seed a test database or a fixture.',
        'Check whether a password matches a hash taken from a user table or a config file.',
        'Compare how memory, passes and parallelism change the time before you choose settings for your application.',
      ],
      title: 'When to use Argon2 Hash & Verify',
    },
  ],
  examples: [
    'Hash "correct horse battery staple" with the defaults → a $argon2id$v=19$m=19456,t=2,p=1$ string and "argon2id · 19 MiB · 2 passes · took 214 ms."',
    'Hash the same password twice with a blank salt → two different hashes, because each run draws a new 16-byte salt.',
    'Hash "password" with salt 736f6d6573616c74 (hex of "somesalt") → the same string on every run.',
    'Verify "password" against $argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc → Match.',
    'Verify "Password" against the same hash → No match, because the comparison is case-sensitive.',
    'Verify a hash with m=4194304 → an error that memory must be between 1024 and 65536 KiB, before any work starts.',
  ],
  faq: [
    {
      answer:
        'Start from the OWASP Argon2id default of 19 MiB, 2 passes and 1 lane. Raise memory first and then passes until a hash takes the longest your login path can afford, and use the same settings on the server.',
      question: 'Which parameters should I use?',
    },
    {
      answer:
        'A hash with 64 MiB and 10 passes blocks the shared worker for several seconds, so the next run in the same editor waits until it finishes. Keep settings modest when you only need a test fixture.',
      question: 'Why is the tool slow with large settings?',
    },
    {
      answer:
        'A blank salt draws 16 random bytes on every run, so the output changes each time. That is why the tool does not run automatically. Enter a fixed salt for a reproducible hash, and use Verify to check a password.',
      question: 'Why does the hash change every time?',
    },
    {
      answer:
        'Use Argon2id unless you have a reason not to. It mixes the data-independent passes of Argon2i with the data-dependent passes of Argon2d, so it holds up against both side-channel and GPU attacks.',
      question: 'Argon2id, Argon2i or Argon2d?',
    },
    {
      answer:
        'No. The password is hashed in your browser and discarded. It is a password field, so it is excluded from saved drafts.',
      question: 'Is my password stored or sent anywhere?',
    },
  ],
  help: 'Choose Hash or Verify.\n\nEnter the password. In Hash mode pick the variant, memory, iterations, parallelism, hash length and an optional salt; in Verify mode paste the PHC hash.\n\nPress Run. Large memory and many passes can take several seconds.\n\nCopy or save the hash, or read Match or No match.',
  notes: [
    'Memory is 1,024 to 65,536 KiB (64 MiB at most), iterations 1 to 10, parallelism 1 to 4 and hash length 16 to 64 bytes. Values outside a range are errors, never clamped.',
    'A pasted hash is checked against the same ranges before any work, so a hostile hash cannot ask for gigabytes of memory.',
    'The salt is hex or Base64 (standard or URL-safe, padding optional) of 8 to 64 bytes. Blank means 16 random bytes.',
    'The password is used exactly as typed, in UTF-8, 1 to 1,024 bytes. Spaces are kept and nothing is trimmed. An empty password is an error.',
    'Not supported: a secret (pepper), associated data, Argon2 version 16 (1.0) hashes, memory above 64 MiB and multiple threads. Lanes run one after another in the worker.',
    'A hash without v= is read as version 16 and gives "Argon2 version 16 (1.0) is not supported." Only version 19 (0x13) is accepted.',
    'Whitespace around a pasted hash is ignored. The comparison runs in constant time over the whole hash.',
    'The tool does not run automatically because the output is random and large settings take time. Press Run.',
  ],
};
