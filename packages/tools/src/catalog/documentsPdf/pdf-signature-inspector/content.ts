import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A digitally signed PDF stores each signature in a signature field. This tool finds every field of that kind, signed or empty, and lists what the signature itself claims: the field name, the signer name, reason, location and contact, the signing time, the signature format and the byte range it covers.',
      title: 'What the report shows',
    },
    {
      content: [
        'The byte range says which parts of the file the signature covers. When it ends exactly at the end of the file, the signature covers the whole file. When bytes follow it, the report says how many were appended after the signature, which is how later edits and added signatures look.',
        'The signature is decoded as CMS (PKCS #7). For each signer the report names the digest and signature algorithms, the signing time, whether a message digest, a CAdES signing-certificate-v2 attribute and a signature timestamp are present, and the signer certificate: subject, issuer, serial, validity, self-signed flag, key and SHA-256 fingerprint. Each signer certificate is also offered as a PEM file.',
        'Document timestamps (RFC 3161) are listed as document-timestamp, and a certification signature reports its DocMDP level from 1 (no changes allowed) to 3 (form filling, signing and comments allowed).',
        'A signature whose data cannot be decoded is reported with an error message, and the other signatures are still listed.',
      ],
      title: 'Byte range, signers and certificates',
    },
  ],
  examples: [
    'Check whether a contract PDF carries a signature and who the signer is.',
    'Find out how many bytes were appended after the last signature.',
    'See the reason, location and signing time a signer entered.',
    'Export the signer certificate as a PEM file and inspect it in the certificate decoder.',
    'List the empty signature fields of a form that still waits for signers.',
    'Spot a document timestamp and the certification level of a PDF.',
  ],
  faq: [
    {
      answer:
        'No. The tool never checks the signature, the digest, the certificate chain, revocation or trust. It only shows that a signature is present and what it says about the signer, so a PDF can be listed here and still be invalid or altered.',
      question: 'Does it tell me whether the signature is valid?',
    },
    {
      answer:
        'The signature covers a byte range, and bytes after that range were added later. That is normal for a second signature or a saved form, but it can also be an edit, so the report counts the bytes.',
      question: 'What does "bytes appended" mean?',
    },
    {
      answer:
        'The PDF has no signature field in its form, or the field was removed from the form while the signature data stayed in the file. The report then says No signature fields found, which is not an error.',
      question: 'Why does it find no signatures?',
    },
    {
      answer:
        'Some signatures carry no readable CMS data, for example a placeholder that was never filled or a damaged file. That signature is listed with an error and the rest of the report still works.',
      question: 'Why does one signature show an error?',
    },
  ],
  help: 'Choose a PDF. The tool lists every signature field, signed or empty, with the signer details, the signing time and the byte range.\n\nThe JSON report shows, for each signature, the algorithms, the optional attributes and the signer certificate. A certification signature adds its DocMDP level.\n\nEach signer certificate is offered as a signature-N.pem file that you can open in a certificate decoder.\n\nThe tool only shows what the file claims. It does not verify signatures, chains or revocation, and every summary says so.',
  notes: [
    'Everything runs locally with pdf-lib; the PDF never leaves your device.',
    'Presence and signer only: signatures, digests, chains, revocation and trust are never checked.',
    'Signature fields are found by walking the form field tree of the latest revision, so a field that no longer belongs to the form is not listed.',
    'A byte range is well formed when it starts at 0, ascends, stays inside the file and leaves exactly the signature data as its gap.',
    'adbe.x509.rsa_sha1 signatures report the first certificate from the Cert entry as the signer.',
    'In an encrypted PDF the signature data can still be read, but the name, reason, location, contact and date text is encrypted, so it is omitted and the summary says so.',
  ],
};
