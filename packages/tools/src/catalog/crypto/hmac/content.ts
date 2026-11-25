import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'HMAC combines a shared secret and message with a hash algorithm to produce an authentication code.',
        'It does not encrypt the message. This tool generates a digest, not incoming-signature verification or HTTP signing conventions.',
        'Message and key are literal UTF-8, including spaces; hex/Base64 strings are not decoded as byte keys.',
      ],
      title: 'What is HMAC?',
    },
    {
      content: [
        'Reproduce an expected keyed digest in a fixture.',
        'Debug exact message/key bytes used by an integration.',
        'Generate a comparison value; implement constant-time verification in your application.',
      ],
      title: 'When to use HMAC Generator',
    },
  ],
  examples: [
    'hello with Secret secret and SHA-256 → 88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b.',
    'hello with Secret super-secret-key and SHA-256 → eb25f2fffac06aa754e192ad1a06964460758c15efceb48330d6446325b925a3.',
    'hello with Secret " secret " → bf70e917bc72ef61fa8df16ec5aef45084f6ce2cae7c459918468f359bf3dc6a; the spaces are part of the key.',
    'Empty message with Secret demo-key → 8a9016cda075fc942ab4ae3b189fcb2011cfdc22916a63c5d2684daca8f1f026; an empty Secret is an error.',
    'hello with Secret demo-key and SHA-1 → 4146a08d2c2c822ca47f92fe54ba0d2ff0595120, 40 hex characters.',
  ],
  faq: [
    {
      answer:
        'A hash depends only on the message, so anyone can recompute it. An HMAC also mixes in a secret key, so only someone who holds the key can produce a matching value, which is why it is used to sign webhooks and API requests.',
      question: 'What is the difference between a hash and an HMAC?',
    },
    {
      answer:
        'Paste the exact raw request body, enter the webhook secret and choose SHA-256. The X-Hub-Signature-256 header should equal sha256= followed by the hex result; reformatting the JSON body changes the digest.',
      question: 'How do I check a GitHub webhook signature?',
    },
    {
      answer:
        'Not as bytes. The Secret is always used as literal UTF-8 text, so a hex or Base64 string counts as those characters, not the bytes it encodes. Integrations that issue Base64 keys need a tool that decodes the key first.',
      question: 'Can I use a hex or Base64 secret?',
    },
    {
      answer:
        'Compare four things: the exact message bytes (whitespace, line endings, JSON key order), the exact secret, the algorithm and the output format. This tool prints lowercase hex, and a Base64 signature encodes the same bytes differently.',
      question: 'Why doesn’t my HMAC match the expected value?',
    },
    {
      answer:
        'HMAC-SHA1 is not broken the way plain SHA-1 is, because HMAC does not rely on collision resistance. It is still a legacy choice: use HMAC-SHA256 or HMAC-SHA512 unless an existing integration requires SHA-1.',
      question: 'Is HMAC-SHA1 still secure?',
    },
  ],
  help: 'Enter the exact message and Secret. Empty messages are allowed; the key must have at least one character.\n\nChoose SHA-256/SHA-512 or legacy SHA-1 and run explicitly.\n\nCopy/download hmac.txt. Summaries/exports do not contain the key.\n\nSample keys are public demonstration values. Incoming signatures are not verified here.',
  notes: [
    'Secret is a password field excluded from saved drafts.',
    'Message/key spaces are preserved; no trimming or normalization.',
    'Only literal UTF-8 keys are supported, not decoded byte keys.',
    'SHA-1 is for existing integrations; use SHA-256/SHA-512 for new ones.',
    'Generation is not encryption, constant-time verification or a complete signing protocol.',
    'Copied/exported HMAC values can still be sensitive in context.',
  ],
};
