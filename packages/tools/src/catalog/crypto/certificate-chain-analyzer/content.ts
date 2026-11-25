import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A chain links each certificate to an issuer. This analyzer examines only the supplied order and adjacent pairs.',
        'issuerMatchesNextSubject compares parsed names. signatureVerified uses supported RSA PKCS#1 v1.5 and ECDSA verification: false means a checked signature failed, null means unsupported/unavailable, never success.',
        'A terminal self-issued certificate or verified self-signature does not establish browser/OS trust. trustEstablished is always false.',
      ],
      title: 'What is internal chain analysis?',
    },
    {
      content: [
        'Review local leaf-to-root development bundles.',
        'Find wrong order or a broken adjacent signature.',
        'Distinguish unchecked algorithms from failed checks before using a complete PKI validator.',
      ],
      title: 'When to use Certificate Chain Analyzer',
    },
  ],
  examples: [
    'Leaf, then root → issuerMatchesNextSubject true, signatureVerified true and terminal selfSignatureVerified true.',
    'Root, then leaf → issuerMatchesNextSubject false and signatureVerified false; the order is not repaired.',
    'Root only → links [] and terminal selfSignatureVerified true.',
    'The same leaf twice → issuerMatchesNextSubject false, because the leaf did not issue itself.',
    'An RSA-PSS or Ed25519 signed certificate → signatureVerified null, meaning not checked.',
  ],
  faq: [
    {
      answer:
        'Leaf first, then the certificate that issued it, and so on toward the root, as in a fullchain.pem file. Each certificate is checked against the next one and the bundle is never reordered, so a reversed bundle shows failed links.',
      question: 'What order should the certificates be in?',
    },
    {
      answer:
        'The signature was not checked. Only RSA PKCS#1 v1.5 and ECDSA (P-256, P-384 or P-521) signatures with SHA-1, SHA-256, SHA-384 or SHA-512 are verified, and the issuer key must match the signature type; RSA-PSS and Ed25519 signatures give null, which is neither a pass nor a failure.',
      question: 'What does signatureVerified null mean?',
    },
    {
      answer:
        'No. trustEstablished is always false: the tool has no trust store and checks no hostname, revocation, basic constraints, key usage or path length. Use openssl verify or a real TLS client for a trust decision.',
      question: 'Does a fully verified chain mean browsers will trust it?',
    },
    {
      answer:
        'No. It makes no network requests and does not follow the Authority Information Access URL. Get the intermediate from your CA or from the server’s full chain and paste it after the leaf.',
      question: 'Can it download a missing intermediate certificate?',
    },
    {
      answer:
        'Up to 32 certificates in at most 1 MiB of PEM text. Only BEGIN CERTIFICATE blocks are read, so a private key or other block in the same file is ignored.',
      question: 'How many certificates can I analyze at once?',
    },
  ],
  help: 'Paste a leaf-to-root bundle or choose a local PEM text file. Limits: 1 MiB, 32 certificates.\n\nRun explicitly. A selected file has precedence; no issuers are downloaded.\n\nRead each name match/signature result alongside time statuses and terminal information.\n\nCopy/download certificate-chain-analyzer.json. This is internal analysis, not a TLS trust verdict.',
  notes: [
    'No issuer discovery, network fetch or reordering.',
    'Only supported RSA PKCS#1 v1.5 and ECDSA signatures are checked; other cases return null.',
    'Name equality is not cryptographic verification.',
    'No hostname, revocation, CA constraints, key usage or external trust-store checks.',
    'One certificate has zero links and does not establish trust.',
    'Exports contain certificate identities and analysis, not raw PEM.',
  ],
};
