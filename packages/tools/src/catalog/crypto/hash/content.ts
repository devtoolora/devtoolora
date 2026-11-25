import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A hash maps bytes to a fixed-length digest. Exact bytes and algorithm produce the same value.',
        'Text is UTF-8 without trimming or normalization. Spaces and newlines change the digest. Files are raw bytes, not decoded text.',
        'Hashing is not encryption. MD5/SHA-1 are legacy options, not modern collision-resistant security or password storage.',
      ],
      title: 'What is a cryptographic hash?',
    },
    {
      content: [
        'Compare content with a digest from a trusted source.',
        'Create repeatable fingerprints for text fixtures and local files.',
        'Investigate whitespace and line-ending differences.',
      ],
      title: 'When to use Hash Generator',
    },
  ],
  examples: [
    'hello with SHA-256 → 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.',
    'Empty text with SHA-256 → e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855, the digest of zero bytes.',
    'hello followed by LF with SHA-256 → 5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03, a different digest.',
    'admin with MD5 → 21232f297a57a5a743894a0e4a801fc3 and a legacy-algorithm warning.',
    'A selected file plus pasted text → the file bytes are hashed and the text is ignored.',
  ],
  faq: [
    {
      answer:
        'Usually a trailing newline: echo adds one, so echo hello | sha256sum hashes hello plus LF. Use printf %s hello instead, and make sure both sides use the same algorithm and the same line endings.',
      question: 'Why doesn’t my hash match sha256sum or shasum?',
    },
    {
      answer:
        'No. A hash is one-way, and the tool only computes digests. Short or common inputs such as admin can still be found in precomputed lookup tables, which is why fast hashes are unsuitable for storing passwords.',
      question: 'Can a hash be reversed or decrypted?',
    },
    {
      answer:
        'Not for security. Practical collisions exist for both, so an attacker can craft two different inputs with the same digest. They are fine for matching existing legacy checksums; use SHA-256 or SHA-512 for new integrity checks.',
      question: 'Is MD5 or SHA-1 still safe to use?',
    },
    {
      answer:
        'No. The file is read into memory on your device and hashed with Web Crypto, or with built-in JavaScript for MD5; the tool makes no network request. Files can be up to 5 MiB.',
      question: 'Does hashing a file upload it?',
    },
    {
      answer:
        'SHA-256, SHA-512, SHA-1 and MD5, each written as lowercase hexadecimal. SHA-384, SHA-3, BLAKE2, BLAKE3 and Base64 output are not offered.',
      question: 'Which hash algorithms are supported?',
    },
  ],
  help: 'Enter text or choose a local file up to 5 MiB. Use Clear or a text sample to remove a selected file.\n\nChoose an algorithm and run explicitly. Empty text is valid; whitespace is preserved.\n\nRead the byte-count summary. SHA-256 outputs 64 hex characters, SHA-512 128, SHA-1 40 and MD5 32.\n\nCopy/download hash.txt. Input data and file names are not exported.',
  notes: [
    'Files are read fully into memory, not streamed.',
    'Text is UTF-8 without trimming or normalization.',
    'Browser textareas can normalize CRLF to LF; use a file for original bytes.',
    'A matching hash establishes authenticity only if the expected digest is trusted.',
    'MD5/SHA-1 are legacy options. Fast unsalted hashes are not password-storage schemes.',
    'Invalid algorithms or encoded file data fail without falling back to text.',
  ],
};
