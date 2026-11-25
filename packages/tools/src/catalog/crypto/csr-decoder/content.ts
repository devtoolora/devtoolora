import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A certificate signing request (CSR) is the PKCS#10 file you send to a certificate authority. It carries the subject name, the public key and the extensions you want in the certificate, signed with the matching private key to prove you hold it.',
        'This decoder reads a PEM CERTIFICATE REQUEST (or the older NEW CERTIFICATE REQUEST header) and shows the subject, the key type and size, the requested subjectAltName entries, key usage, extended key usage and basic constraints, plus a SHA-256 fingerprint of the request.',
        'It also checks the self-signature with Web Crypto and flags common problems: missing SANs, a CN that is not among the SANs, short RSA keys and SHA-1 signatures. Everything runs locally.',
      ],
      title: 'What is CSR Decoder?',
    },
    {
      content: [
        'Check a CSR before you submit it to a certificate authority, so a typo in a hostname or a missing SAN does not cost you a reissue.',
        'Review a CSR someone else generated, for example from a load balancer or an appliance, to see exactly which names and key it requests.',
        'Use Certificate Inspector for the issued certificate and PEM Key Inspector for a bare public or private key.',
      ],
      title: 'When to use CSR Decoder',
    },
  ],
  examples: [
    'RSA 2048 request for api.example.com with three SANs → subject, keyUsage, serverAuth, signature valid, no findings.',
    'EC P-256 request with only a CN → medium finding: no subjectAltName.',
    'Request with challengePassword → challengePassword: true and an info finding; the password itself is never shown.',
    'Request signed with sha1WithRSAEncryption → high finding: certificate authorities reject SHA-1.',
    'RSA 1024 request → medium finding asking for at least 2,048 bits.',
    'A request with one changed byte → signatureValid: false.',
  ],
  faq: [
    {
      answer:
        'The request proves that whoever created it holds the private key. A false result means the request was altered or corrupted after signing, so do not submit it.',
      question: 'What does signatureValid mean?',
    },
    {
      answer:
        'Web Crypto cannot verify every algorithm. RSA-PSS, Ed25519 and curves other than P-256, P-384 and P-521 are decoded but reported as not verified rather than valid or invalid.',
      question: 'Why is the signature not verified?',
    },
    {
      answer:
        'No. Browsers match hostnames only against subjectAltName, so the CN alone is ignored. Put every hostname, including the CN, into the SAN extension.',
      question: 'Is a CN enough for a TLS certificate?',
    },
    {
      answer:
        'No. The tool only reports that the attribute is present. The value is never shown, put in the summary or saved in the JSON result.',
      question: 'Does the tool show the challengePassword?',
    },
  ],
  help: 'Paste a PEM block that starts with -----BEGIN CERTIFICATE REQUEST----- or choose a .csr file. Text outside the block, such as a comment line, is ignored.\n\nThe result is JSON with the subject, public key, requested extensions, other attributes, the self-signature check, a SHA-256 fingerprint of the DER request and a list of findings.\n\nThe summary shows the CN, the key, the number of SANs, the signature status and the number of findings.\n\nCopy the JSON, send it to the scratchpad or save it as a file.',
  notes: [
    'Only PEM input is accepted; convert a DER file with openssl req -inform DER -in request.der.',
    'Supported signatures are RSA PKCS#1 v1.5 and ECDSA with SHA-1, SHA-256, SHA-384 or SHA-512.',
    'Subject attributes keep their order; a multi-valued RDN is joined with +.',
    'Unknown subject attributes and request attributes appear as their dotted OID.',
    'The fingerprint is the colon-separated SHA-256 of the whole DER request, the same value as openssl req -outform DER | openssl dgst -sha256 -c.',
    'Findings are sorted from high to info and are advice, not a certificate authority policy check.',
    'Input is limited to 1 MiB.',
  ],
};
