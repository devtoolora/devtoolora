import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A JSON Web Key (JWK, RFC 7517) describes a public or private key as JSON, while PEM wraps the same key as Base64 DER between BEGIN and END lines. Libraries and services often want one form when you hold the other.',
        'This tool converts RSA, EC (P-256, P-384, P-521) and Ed25519 keys in both directions. A private JWK becomes a PKCS#8 PRIVATE KEY, a public JWK becomes an SPKI PUBLIC KEY, and PEM input also accepts PKCS#1, SEC1 and certificates.',
        'The direction is detected from the first character of the input. Everything runs locally with the Web Crypto API; keys are never uploaded or saved in drafts.',
      ],
      title: 'What is the JWK ↔ PEM Converter?',
    },
    {
      content: [
        'Turn a key from a JWKS endpoint into a PEM file for OpenSSL, nginx or a library that only reads PEM.',
        'Turn a PEM private or public key into a JWK to publish in a JWKS or to feed a JOSE library.',
        'Pull the public key out of a certificate as a JWK without running OpenSSL.',
      ],
      title: 'When to use JWK ↔ PEM Converter',
    },
  ],
  examples: [
    'An RSA public JWK with n and e → a -----BEGIN PUBLIC KEY----- block and the summary RSA 2048-bit public key · JWK → PEM.',
    'An EC P-256 private JWK with d → a -----BEGIN PRIVATE KEY----- PKCS#8 block.',
    'An Ed25519 public JWK with crv Ed25519 → a PUBLIC KEY block of 44 bytes of DER.',
    'A JWK Set with two keys → two PEM blocks joined by a line break, with the kid values in the summary.',
    'A PUBLIC KEY PEM → a JWK with kty, crv, x and y and no alg, key_ops or ext members.',
    'A CERTIFICATE PEM → the JWK of the public key inside it.',
  ],
  faq: [
    {
      answer:
        'No. A symmetric oct key is a shared secret, not a key pair, and PEM has no standard form for it. The tool reports that an oct JWK has no PEM form.',
      question: 'Why can I not convert an oct JWK?',
    },
    {
      answer:
        'The conversion uses the Web Crypto API, which supports P-256, P-384, P-521 and Ed25519. secp256k1, X25519 and Ed448 keys are reported as unsupported curves.',
      question: 'Which curves are supported?',
    },
    {
      answer:
        'No. The tool is for the key itself only. A JWK alg such as PS256 only chooses the RSA-PSS import, and alg, key_ops and ext are dropped from JWK output while kid is kept.',
      question: 'Are alg and key_ops kept in the output?',
    },
    {
      answer:
        'No. The conversion runs in your browser or editor, and the input is excluded from saved drafts. Keys and secrets never appear in the summary or in error messages.',
      question: 'Is my private key sent anywhere?',
    },
  ],
  help: 'Paste a JWK, a JWK Set or a PEM key.\n\nLeave Direction on Auto-detect, or pick JWK to PEM or PEM to JWK to be explicit.\n\nRun the tool to get PEM blocks or a JWK.\n\nCopy or save the result as key.pem or key.json.',
  notes: [
    'JWK input starting with { converts to PEM; input starting with -----BEGIN converts to a JWK.',
    'A JWK Set may hold at most 100 keys; each key becomes one PEM block, in order, separated by a line break.',
    'Private keys are written as PKCS#8 and public keys as SPKI.',
    'PEM input accepts PUBLIC KEY, PRIVATE KEY, RSA PUBLIC KEY, RSA PRIVATE KEY, EC PRIVATE KEY and CERTIFICATE blocks. An EC PARAMETERS block next to the key is ignored.',
    'PEM keys restricted to RSA-PSS are refused, because Web Crypto imports RSA PEM keys only as rsaEncryption.',
    'Encrypted keys and OpenSSH private keys are rejected with the command that converts a copy.',
    'Input is limited to 1 MiB. Keys with use set to enc are not converted.',
  ],
};
