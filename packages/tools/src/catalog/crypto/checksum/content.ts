import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A checksum is a short number computed from data so that accidental changes can be detected. Cyclic redundancy checks (CRC) treat the bytes as a polynomial and keep the remainder; Adler-32 and Fletcher keep two running sums. All of them are fast and fixed size.',
        'This tool computes nine of them at once: CRC-32 as used by ZIP, PNG and Ethernet, CRC-32C used by iSCSI and many storage systems, three common CRC-16 variants, CRC-8, Adler-32 as used by zlib, and Fletcher-16 and Fletcher-32.',
        'Text is encoded as UTF-8, or you can choose a local file instead. Each result shows uppercase hexadecimal and the unsigned decimal value. Everything runs in your browser.',
      ],
      title: 'What is Checksum Calculator?',
    },
    {
      content: [
        'Verify a download or an archive entry against a published CRC-32, or confirm that a protocol frame matches its CRC-16 or CRC-8 trailer.',
        'Compare your own implementation with known-good values: the standard check input 123456789 gives CBF43926 for CRC-32.',
        'A checksum is not a security feature. For tamper detection use Hash, and for keyed authentication use HMAC.',
      ],
      title: 'When to use Checksum Calculator',
    },
  ],
  examples: [
    '123456789 with All → nine lines, starting CRC-32  CBF43926  3421780262.',
    'hello with CRC-32 → 3610A686 and 907060870.',
    '123456789 with CRC-16/MODBUS → 4B37.',
    'Wikipedia with Adler-32 → 11E60398.',
    'abcde with Fletcher-32 → F04FC729; the odd last byte is padded with zero.',
    'Empty text with CRC-32 → 00000000; with Adler-32 → 00000001.',
  ],
  faq: [
    {
      answer:
        'CRC-32 is the checksum used by ZIP, gzip, PNG and Ethernet. It uses the reflected polynomial EDB88320, starts at FFFFFFFF and inverts the result. CRC-32C uses a different polynomial and gives a different value.',
      question: 'Which CRC-32 does this compute?',
    },
    {
      answer:
        'Several CRC-16 algorithms exist with different polynomials, start values and bit order. ARC, MODBUS and CCITT-FALSE are the common ones; pick the one your protocol documents and compare against its check value.',
      question: 'Why are there three CRC-16 variants?',
    },
    {
      answer:
        'No. A checksum only catches accidental corruption, and anyone can craft data with a chosen checksum. Use a cryptographic hash such as SHA-256, or an HMAC when a secret is involved.',
      question: 'Can I use a checksum to detect tampering?',
    },
    {
      answer:
        'A file you choose takes precedence over the text box and can be up to 5 MiB. Text is limited to 1,048,576 characters and is hashed as UTF-8, so non-ASCII characters count as several bytes.',
      question: 'How are files and text handled?',
    },
  ],
  help: 'Type or paste text, or choose a local file; a file takes precedence over the text.\n\nPick All to see every checksum, or one algorithm to get its hexadecimal value and its decimal value on separate lines.\n\nText is encoded as UTF-8 before it is summed, and files are read byte for byte.\n\nCopy the result, send it to the scratchpad or save it as a text file.',
  notes: [
    'Hexadecimal values are uppercase and zero padded to 8 digits for 32-bit, 4 for 16-bit and 2 for 8-bit results.',
    'Decimal values are unsigned integers.',
    'Text is limited to 1,048,576 characters and files to 5 MiB.',
    'Fletcher-32 reads little-endian 16-bit words and pads an odd last byte with zero; its sums are modulo 65535.',
    'Fletcher-16 sums bytes modulo 255 and shows the second sum in the high byte.',
    'Empty input is valid: CRC-32 is 00000000 and Adler-32 is 00000001.',
    'Checksums detect accidental changes only and offer no protection against deliberate tampering.',
  ],
};
