import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'PEM wraps encoded bytes in BEGIN/END labels. Recognized containers include SPKI/PKCS#1 public keys, PKCS#8/PKCS#1/SEC1 private keys and encrypted-private-key labels.',
        'Public fingerprints identify the encoded container: SPKI DER and PKCS#1 DER fingerprints can differ for the same mathematical key. fingerprintFormat identifies the representation.',
        'Private output contains container/algorithm metadata only. Encryption is detected, not decrypted; passphrases are not accepted.',
      ],
      title: 'What is PEM key inspection?',
    },
    {
      content: [
        'Identify public/private container types.',
        'Compare a public fingerprint using the same DER representation.',
        'Use dedicated crypto tooling for decryption, full key validation or key-pair matching.',
      ],
      title: 'When to use PEM Key Inspector',
    },
  ],
  examples: [
    'BEGIN PUBLIC KEY with a 2048-bit RSA key → kind public, algorithm rsa, modulusLength 2048, fingerprintFormat SPKI DER.',
    'BEGIN PUBLIC KEY with a P-256 key → algorithm ec, namedCurve P-256.',
    'BEGIN RSA PUBLIC KEY → fingerprintFormat PKCS#1 DER, a different fingerprint from the SPKI form of the same key.',
    'BEGIN PRIVATE KEY → kind private and its algorithm, with no fingerprint or key numbers.',
    'BEGIN ENCRYPTED PRIVATE KEY → encryptedPrivateKey true and algorithm encrypted; nothing is decrypted.',
    'An ssh-rsa AAAA… line → error: Provide exactly one PEM key container.',
  ],
  faq: [
    {
      answer:
        'The key is parsed on your device without any network request, and the report holds only the container type and algorithm, never key numbers. Still, avoid pasting production private keys anywhere you do not have to; the public key answers most questions.',
      question: 'Is it safe to paste a private key?',
    },
    {
      answer:
        'No. ENCRYPTED PRIVATE KEY blocks and legacy Proc-Type: 4,ENCRYPTED keys are reported as encrypted, but there is no passphrase field. To inspect further, decrypt a copy with openssl pkey -in key.pem -out plain.pem.',
      question: 'Can it decrypt an encrypted private key?',
    },
    {
      answer:
        'ssh-rsa lines and OPENSSH PRIVATE KEY blocks are not PEM key containers this tool reads. For an RSA or ECDSA public key, ssh-keygen -e -m PKCS8 -f id_rsa.pub prints a BEGIN PUBLIC KEY block you can paste.',
      question: 'Why is my OpenSSH key rejected?',
    },
    {
      answer:
        'No. ssh-keygen hashes the OpenSSH key encoding and prints Base64 such as SHA256:…, while this tool hashes the SPKI or PKCS#1 DER bytes and prints colon-separated hex. Compare fingerprints only between tools that hash the same encoding.',
      question: 'Does the fingerprint match ssh-keygen -l?',
    },
    {
      answer:
        'Derive the public key with openssl pkey -in key.pem -pubout, paste it here and compare publicKeyFingerprintSha256 with publicKey.fingerprintSha256 from Certificate Inspector. Both hash the SPKI DER, so equal values mean the same key pair.',
      question: 'How can I check that a private key matches a certificate?',
    },
  ],
  help: 'Paste exactly one supported key block or choose a PEM text file up to 1 MiB.\n\nRun explicitly. Files have precedence; pasted key text is excluded from new VS Code drafts.\n\nRead kind, container, algorithm/details and fingerprintFormat. There is no passphrase/decryption step.\n\nCopy/download pem-key-inspector.json. Raw key bytes are not exported; key strength and pair matching are not certified.',
  notes: [
    'Certificates, CSRs, OpenSSH and multiple key blocks are rejected.',
    'Raw DER files are not accepted.',
    'RSA modulus size is metadata, not proof that the key is safe.',
    'Encrypted-container detection does not prove decryptability.',
    'Public fingerprints depend on container representation.',
    'The visible paste field, source file and clipboard can expose keys; handle them carefully.',
  ],
};
