import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An SSH key pair lets you log in to a server without a password. You keep the private key on your machine and put the public key in the ~/.ssh/authorized_keys file of the server. The server then proves you own the private key by challenge, and the key never travels.',
        'This tool creates an Ed25519 pair with the Web Crypto API. It writes the public key as a single authorized_keys line (ssh-ed25519, Base64 blob, optional comment), the private key in the OpenSSH format (openssh-key-v1) and the SHA256 fingerprint that ssh-keygen -l prints.',
        'Everything happens in your browser. Nothing is uploaded, and nothing is saved, so copy or save the private key before you leave.',
      ],
      title: 'What is an SSH key pair generator?',
    },
    {
      content: [
        'Create a key for a deploy user, a CI job or a test server when you cannot run ssh-keygen on the machine at hand.',
        'Check the fingerprint a server or Git host shows against the one printed here.',
        'Save the private key as ~/.ssh/id_ed25519, set its mode to 600 and add the public line to authorized_keys. For long-lived personal keys prefer ssh-keygen with a passphrase, because this key is not encrypted.',
      ],
      title: 'When to use SSH Key Pair Generator',
    },
  ],
  examples: [
    'Comment alice@laptop → ssh-ed25519 AAAA… alice@laptop plus a -----BEGIN OPENSSH PRIVATE KEY----- block.',
    'Comment deploy@ci → a key you can add as a read-only deploy key on a Git host.',
    'Comment backup@nas → a dedicated key for a backup job, easy to spot in authorized_keys.',
    'Comment dev@workstation → the comment is stored in both the public line and the private key.',
    'Comment admin@server → the fingerprint reads SHA256: followed by 43 Base64 characters.',
    'Empty comment → the public line has only the type and the key, with no trailing space.',
  ],
  faq: [
    {
      answer:
        'Ed25519 keys are short, fast and secure, and OpenSSH has supported them since version 6.5. Use RSA only for old systems that reject Ed25519, and create those with the Key Pair Generator.',
      question: 'Why does this tool only make Ed25519 keys?',
    },
    {
      answer:
        'Save it to a file such as ~/.ssh/id_ed25519 with a final newline and run chmod 600 on it. OpenSSH refuses a private key that other users can read.',
      question: 'How do I use the private key?',
    },
    {
      answer:
        'No. The key is written with cipher none, so anyone who gets the file can use it. Treat it like a password, or add a passphrase afterwards with ssh-keygen -p.',
      question: 'Is the private key protected by a passphrase?',
    },
    {
      answer:
        'It is the SHA-256 hash of the public key blob in Base64 without padding, the format used by ssh-keygen -l and by Git hosts. It identifies the key without showing it.',
      question: 'What is the fingerprint?',
    },
  ],
  help: 'Optionally enter a comment, such as user@host. It is stored in the public line and in the private key.\n\nRun the tool to create a new Ed25519 key pair. Every run makes a different pair.\n\nCopy the public line into authorized_keys on the server or Git host.\n\nSave the private key to ~/.ssh/id_ed25519 and run chmod 600 on it.',
  notes: [
    'The comment is at most 256 characters and must be a single line.',
    'The private key uses the openssh-key-v1 format with cipher none and kdf none, so it is not encrypted.',
    'The private section holds two equal random check values, the key type, the public key, the 32-byte seed plus the public key, the comment and padding to 8 bytes.',
    'The PEM body is wrapped at 70 columns like files written by ssh-keygen.',
    'The fingerprint is SHA256: plus the Base64 digest of the public key blob without trailing = signs.',
    'Ed25519 needs a recent browser; if it is missing the tool reports that this browser cannot generate Ed25519 keys.',
    'Every run creates a new pair, so results change each time and nothing is stored.',
  ],
};
