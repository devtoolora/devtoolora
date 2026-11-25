import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'BIP39 is the standard that turns random entropy into a list of 12 to 24 easy-to-write words. The entropy gets a short SHA-256 checksum appended, the bits are cut into 11-bit groups, and each group picks a word from a fixed list of 2,048.',
        'The mnemonic is then stretched into a 64-byte seed with PBKDF2-HMAC-SHA512 and 2,048 iterations. An optional passphrase is mixed into the salt, so the same words with a different passphrase give a completely different seed.',
        'This tool generates mnemonics with your browser random number generator and validates pasted ones: it normalizes whitespace and case, lists unknown words, checks the checksum and shows the entropy. Everything runs locally.',
      ],
      title: 'What is BIP39 Mnemonic Generator & Validator?',
    },
    {
      content: [
        'Check that a recovery phrase was copied correctly: a single typo or swapped word shows up as an unknown word or a failed checksum.',
        'Produce test phrases and seeds for wallet development, or compare your implementation with the reference vectors.',
        'Never type a phrase that protects real funds into any website. Use this tool with throwaway test phrases only.',
      ],
      title: 'When to use BIP39 Mnemonic Generator & Validator',
    },
  ],
  examples: [
    'abandon ×11 + about → 12 words, checksum valid, entropy 00000000000000000000000000000000.',
    'Same phrase with passphrase TREZOR and Show seed → seed c55257c3...63b04.',
    'abandon ×12 → checksum invalid, but no unknown words.',
    'abandon ×10 + abouts about → unknown word abouts (word 11).',
    'Generate with 24 words → one 24-word phrase with 256-bit entropy.',
    'Generate three 12-word phrases → three lines, one phrase each.',
  ],
  faq: [
    {
      answer:
        'Yes, the entropy comes from the Web Crypto random generator of your browser. Even so, do not use a phrase generated on a website for real funds; generate those on a hardware wallet.',
      question: 'Is the generated phrase safe to use?',
    },
    {
      answer:
        'The last word of a phrase carries a checksum, so a typo is usually caught. One in 16 random 12-word lists still passes by chance, so a valid checksum proves a correct format, not that the phrase belongs to a wallet.',
      question: 'What does a valid checksum prove?',
    },
    {
      answer:
        'The passphrase is part of the PBKDF2 salt. Each passphrase produces a different seed and therefore a different wallet. There is no wrong passphrase, so a typo silently opens an empty wallet.',
      question: 'What does the passphrase do?',
    },
    {
      answer:
        'Only the English word list is built in. Input is limited to 1,024 characters, and nothing you type or generate is sent anywhere or stored.',
      question: 'Which languages and limits apply?',
    },
  ],
  help: 'Choose Validate to paste a phrase, or Generate to create one to ten new phrases of 12, 15, 18, 21 or 24 words.\n\nValidation ignores case, tabs, line breaks and repeated spaces, and reports the word count, the checksum, unknown words and the entropy.\n\nTurn on Show seed to derive the 64-byte seed, optionally with a passphrase.\n\nCopy the result, send it to the scratchpad or save it as a text file.',
  notes: [
    'The word list is the official English BIP39 list of 2,048 words; every word is unique in its first four letters.',
    'Entropy of 128, 160, 192, 224 and 256 bits gives 12, 15, 18, 21 and 24 words.',
    'The checksum is the first entropy-bits / 32 bits of the SHA-256 of the entropy.',
    'The seed is PBKDF2-HMAC-SHA512 with 2,048 iterations, 64 bytes and the salt "mnemonic" plus the passphrase, both NFKD normalized.',
    'Mnemonic and passphrase are each limited to 1,024 characters.',
    'The seed is derived even when the checksum is invalid, because wallets accept any phrase; the report tells you it is unusual.',
    'Use test phrases only: a phrase pasted into any website should be treated as exposed.',
  ],
};
