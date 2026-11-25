import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'AES-256-GCM is an authenticated cipher: it hides the data and also detects any change to it. A passphrase is not a key, so the tool first stretches it into a 256-bit key with PBKDF2-SHA-256 and a random 16-byte salt, then encrypts with a random 12-byte IV.',
        'The output is a single Base64 envelope: one version byte, the PBKDF2 iteration count, the salt, the IV and the ciphertext with its 16-byte authentication tag. Because everything needed except the passphrase travels inside the envelope, decrypting needs only the envelope and the passphrase.',
        'Everything runs locally with the Web Crypto API. Nothing is uploaded, and the passphrase is never saved in drafts.',
      ],
      title: 'What is AES Encrypt & Decrypt?',
    },
    {
      content: [
        'Protect a note, a token or a small file before pasting it into a ticket, a chat or a config file.',
        'Open an envelope this tool produced and read the text or save the original file.',
        'Check how a passphrase-based scheme is put together. For real systems with key management use a vetted library; use Hash Generator or HMAC for integrity without secrecy.',
      ],
      title: 'When to use AES Encrypt & Decrypt',
    },
  ],
  examples: [
    'Encrypt "Hello, world!" with 10,000 iterations → an 84-character Base64 envelope.',
    'Encrypt the same text twice → two different envelopes, because salt and IV are random.',
    'Decrypt the envelope with the right passphrase → the original text and the iteration count it used.',
    'Decrypt with a wrong passphrase → "Decryption failed: wrong passphrase or corrupted data."',
    'Choose a local file in Encrypt mode → the file bytes are encrypted instead of the text.',
    'Decrypt with File output → the original bytes are saved as decrypted.bin or your filename.',
  ],
  faq: [
    {
      answer:
        'Not directly. The envelope layout is specific to this tool: version, iterations, salt, IV, then ciphertext and tag. Other tools need the same layout and key derivation to read it.',
      question: 'Can another program decrypt my envelope?',
    },
    {
      answer:
        'AES-GCM authenticates the data, so a wrong passphrase and a changed salt, IV, ciphertext or tag are indistinguishable. Both report the same message and reveal nothing about which one happened. Only an envelope that cannot be read at all gets its own message: too short, an unknown version or an impossible iteration count.',
      question: 'Why is a wrong passphrase not told apart from corruption?',
    },
    {
      answer:
        'More iterations make each passphrase guess slower for an attacker and for you. The default of 600,000 follows current OWASP guidance for PBKDF2-SHA-256; lower values are for tests only.',
      question: 'How many PBKDF2 iterations should I use?',
    },
    {
      answer:
        'No. The passphrase is normalized with Unicode NFKC, used to derive the key and discarded. It is a password field, so it is excluded from saved drafts.',
      question: 'Is my passphrase stored anywhere?',
    },
  ],
  help: 'Choose Encrypt or Decrypt and enter a passphrase.\n\nIn Encrypt mode type or paste text, or choose a local file, then set the PBKDF2 iterations if you need a different cost.\n\nIn Decrypt mode paste the Base64 envelope and choose Text or File output.\n\nCopy or save the result. Keep the passphrase safe: it cannot be recovered.',
  notes: [
    'Text input is at most 1,048,576 characters; a local file is at most 5 MiB. A passphrase is at most 1,024 characters.',
    'The envelope is Base64 of 1 version byte (1), a 4-byte big-endian iteration count, a 16-byte salt, a 12-byte IV and the ciphertext followed by a 16-byte GCM tag.',
    'Iterations range from 1,000 to 10,000,000 and default to 600,000. The count is read back from the envelope when decrypting.',
    'Decrypting accepts standard or URL-safe Base64, with or without padding and with whitespace or line breaks.',
    'A wrong passphrase and a changed salt, IV, ciphertext or tag give the same "Decryption failed" message by design. An envelope that is too short, has an unknown version or holds an impossible iteration count gets its own message.',
    'Text output requires the decrypted bytes to be valid UTF-8; otherwise choose File output to keep the exact bytes.',
    'Encrypting is not signing: anyone with the passphrase can create a valid envelope. Use a proper key-management system for production secrets.',
  ],
};
