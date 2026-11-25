import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An X.509 certificate binds identity metadata to a public key and issuer signature. This tool reads subject, issuer, serial, dates, SANs and fingerprints.',
        'validityStatus compares the time window with the runtime clock. It does not mean trusted, correctly signed or suitable for a hostname.',
        'Certificate fingerprints and public-key fingerprints describe different encoded bytes. Neither is private key material.',
      ],
      title: 'What is certificate inspection?',
    },
    {
      content: [
        'Compare local fingerprints and identity metadata.',
        'Inspect expiry and subject alternative names.',
        'Use Chain Analyzer for bundles and a real TLS verifier for hostname/trust decisions.',
      ],
      title: 'When to use Certificate Inspector',
    },
  ],
  examples: [
    'Local development leaf → subject CN=api.local.test, subjectAltName DNS:api.local.test, DNS:localhost and an RSA key with modulusLength 2048.',
    'IPv6, email and directory-name SANs → IP:2001:db8::1 in compressed form, email:admin@example.com and DirName:/CN=Device/O=Example.',
    'Root certificate → isSelfIssued true, while trustEstablished stays false.',
    'The same certificate with CRLF or LF line endings → the same fingerprintSha256.',
    'A selected file plus pasted text → the file is inspected and the text is ignored.',
    'Two CERTIFICATE blocks → error: use Certificate Chain Analyzer for a bundle.',
  ],
  faq: [
    {
      answer:
        'No. The tool makes no network requests, so it cannot ask a CA whether a certificate was revoked. It also does not verify the signature, chain or hostname; validityStatus only compares the dates with your device clock.',
      question: 'Does it check revocation, OCSP or CRLs?',
    },
    {
      answer:
        'Run openssl s_client -connect example.com:443 -servername example.com -showcerts and copy one BEGIN/END CERTIFICATE block, or export the certificate as PEM from your browser’s certificate viewer. The tool cannot fetch it from a URL.',
      question: 'How do I get a website’s certificate in PEM format?',
    },
    {
      answer:
        'Only PEM text with BEGIN CERTIFICATE lines is read. Convert a binary DER file first with openssl x509 -inform der -in cert.cer -out cert.pem; PKCS#12 (.p12, .pfx) files and CSRs are not supported.',
      question: 'Why is my .cer or .der file rejected?',
    },
    {
      answer:
        'Yes. fingerprintSha256 is the SHA-256 of the certificate’s DER bytes in colon-separated uppercase hex, like openssl x509 -noout -fingerprint -sha256 prints. publicKey.fingerprintSha256 hashes only the public key, so it differs.',
      question: 'Does the SHA-256 fingerprint match what OpenSSL and browsers show?',
    },
    {
      answer:
        'namedCurve shows P-256, P-384, P-521, secp256k1 or brainpoolP256r1, brainpoolP384r1 and brainpoolP512r1 for those curves. Any other curve keeps its OID, such as 1.2.840.10045.3.1.1 for prime192v1, and a key that spells out its curve instead of naming it shows explicit parameters. Key types other than RSA and EC, such as Ed25519, appear as their algorithm OID, for example 1.3.101.112.',
      question: 'How are EC curves and other key types shown?',
    },
  ],
  help: 'Paste exactly one CERTIFICATE block or select a PEM text file up to 1 MiB.\n\nRun explicitly. Clear the file or apply a text sample to return to pasted input.\n\nInspect dates, SANs, key details and fingerprints. trustEstablished remains false.\n\nCopy/download certificate-inspector.json; raw PEM source is not exported.',
  notes: [
    'PEM-wrapped DER only, not raw DER files, CSRs or PKCS#12.',
    'Multiple certificates are rejected here; use Chain Analyzer.',
    'Time-window status relies on the runtime clock.',
    'No signature, hostname, revocation, CA constraint or trust-store validation.',
    'Unknown algorithm/curve OIDs do not imply support or safety.',
    'Identity metadata can contain personal information; reports retain it.',
  ],
};
