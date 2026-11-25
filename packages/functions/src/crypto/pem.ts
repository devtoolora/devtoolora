import {
  fingerprint,
  keyPemBlocks,
  parseAsn1,
  pemError,
  requiredPem,
  rsaBitsFromBytes,
  signatureAlgorithmName,
  toArrayBuffer,
  utcStringTime,
  valueBytes,
  webCryptoSignatureHash,
} from './pemAsn1';
import {
  parseCertificates,
  privateKeyAlgorithm,
  publicKeyInfo,
  type ParsedCertificate,
} from './pemCertificate';

export {
  ecCurveNames,
  keyPemBlocks,
  oid,
  parseAsn1,
  rsaBitsFromBytes,
  valueBytes,
} from './pemAsn1';
export type { Asn1Node } from './pemAsn1';
export { parseCertificate } from './pemCertificate';

export async function inspectCertificate(source: string): Promise<Record<string, unknown>> {
  const certificates = parseCertificates(requiredPem(source, 'Certificate'));

  const [certificate] = certificates;

  if (!certificate || certificates.length !== 1)
    throw pemError(
      'Certificate Inspector accepts exactly one certificate. Use Certificate Chain Analyzer for a bundle.',
    );

  return {
    ...(await certificateDetails(certificate)),
    notice:
      'Metadata and time window only. Signature, hostname, revocation and trust are not verified.',
    trustEstablished: false,
  };
}

export async function analyzeCertificateChain(source: string): Promise<Record<string, unknown>> {
  const certificates = parseCertificates(requiredPem(source, 'Certificate'));
  const links = await Promise.all(
    certificates.slice(0, -1).map(async (certificate, index) => {
      const issuer = certificates[index + 1];

      if (!issuer) throw new Error('Certificate issuer is missing.');

      return {
        fromIndex: index,
        toIndex: index + 1,
        issuerMatchesNextSubject: certificate.issuer === issuer.subject,
        signatureVerified: await verifyCertificateSignature(certificate, issuer),
      };
    }),
  );
  const terminal = certificates.at(-1);

  if (!terminal) throw pemError('No PEM certificate blocks were found.');

  return {
    notice:
      'Internal bundle analysis only. This result does not establish browser or operating-system trust.',
    trustEstablished: false,
    limitations: [
      'Supplied order only; no issuer discovery or reordering.',
      'RSA PKCS#1 v1.5 and ECDSA signatures only; null means unsupported/unavailable, not verified.',
      'No hostname, revocation, CA constraints, key usage or external trust-store validation.',
    ],
    certificateCount: certificates.length,
    certificates: certificates.map(certificateSummary),
    links,
    terminal: {
      subjectMatchesIssuer: terminal.subject === terminal.issuer,
      selfSignatureVerified: await verifyCertificateSignature(terminal, terminal),
    },
  };
}

const supportedKeyLabels = [
  'PUBLIC KEY',
  'RSA PUBLIC KEY',
  'PRIVATE KEY',
  'RSA PRIVATE KEY',
  'EC PRIVATE KEY',
  'ENCRYPTED PRIVATE KEY',
];

export async function inspectPemKey(source: string): Promise<Record<string, unknown>> {
  const input = requiredPem(source, 'PEM key');
  const blocks = keyPemBlocks(input);

  const [block] = blocks;

  if (!block || blocks.length !== 1) throw pemError('Provide exactly one PEM key container.');

  if (block.bytes.length === 0) throw pemError('PEM container has no encoded bytes.');
  if (!supportedKeyLabels.includes(block.label))
    throw pemError('This PEM label is not a supported public/private key container.');

  const encrypted = /ENCRYPTED/i.test(block.label) || /Proc-Type:\s*4,ENCRYPTED/i.test(input);
  const report: Record<string, unknown> = {
    kind: /PUBLIC KEY/i.test(block.label) ? 'public' : 'private',
    encryptedPrivateKey: /PRIVATE KEY/i.test(block.label) ? encrypted : false,
  };

  if (block.label === 'PUBLIC KEY') Object.assign(report, await spkiKeyReport(block.bytes));
  else if (block.label === 'RSA PUBLIC KEY')
    Object.assign(report, await pkcs1PublicKeyReport(block.bytes));
  else if (encrypted) Object.assign(report, encryptedKeyReport(block));
  else {
    report.algorithm = privateKeyAlgorithm(block.bytes, block.label);
    report.details = {};
  }

  return report;
}

async function spkiKeyReport(bytes: Uint8Array) {
  const publicKey = publicKeyInfo(bytes);

  return {
    algorithm: publicKey.algorithm,
    details: publicKey.details,
    publicKeyFingerprintSha256: await fingerprint(publicKey.spkiDer, 'sha256'),
    fingerprintFormat: 'SPKI DER',
  };
}

async function pkcs1PublicKeyReport(bytes: Uint8Array) {
  const key = parseAsn1(bytes);

  if (
    key.tag !== 0x30 ||
    key.children.length !== 2 ||
    key.children.some((child) => child.tag !== 0x02)
  )
    throw pemError('Invalid PKCS#1 public key.');

  return {
    algorithm: 'rsa',
    details: { modulusLength: rsaBitsFromBytes(valueBytes(key.children[0])) },
    publicKeyFingerprintSha256: await fingerprint(bytes, 'sha256'),
    fingerprintFormat: 'PKCS#1 DER',
  };
}

function encryptedKeyReport(block: { bytes: Uint8Array; label: string }) {
  if (block.label === 'ENCRYPTED PRIVATE KEY') {
    const container = parseAsn1(block.bytes);

    if (
      container.tag !== 0x30 ||
      container.children[0]?.tag !== 0x30 ||
      container.children[1]?.tag !== 0x04
    )
      throw pemError('Invalid encrypted PKCS#8 container.');
  }

  return {
    algorithm: 'encrypted',
    details: {},
    note: 'Encrypted private key metadata is detected without decrypting key material.',
  };
}

async function certificateDetails(
  certificate: ParsedCertificate,
): Promise<Record<string, unknown>> {
  return {
    ...certificateSummary(certificate),
    fingerprintSha1: await fingerprint(certificate.der, 'sha1'),
    fingerprintSha256: await fingerprint(certificate.der, 'sha256'),
    fingerprintSha512: await fingerprint(certificate.der, 'sha512'),
    subjectAltName: certificate.subjectAltName,
    signatureAlgorithm: signatureAlgorithmName(certificate.signatureAlgorithmOid),
    signatureAlgorithmOid: certificate.signatureAlgorithmOid,
    publicKey: {
      algorithm: certificate.publicKey.algorithm,
      details: certificate.publicKey.details,
      fingerprintSha256: await fingerprint(certificate.publicKey.spkiDer, 'sha256'),
    },
  };
}

function validityStatus(now: number, startsAt: number, expiresAt: number): string {
  if (now < startsAt) return 'not-yet-valid';
  if (now > expiresAt) return 'expired';

  return 'valid';
}

function certificateSummary(certificate: ParsedCertificate): Record<string, unknown> {
  const startsAt = utcStringTime(certificate.validFrom);
  const expiresAt = utcStringTime(certificate.validTo);
  const now = Date.now();

  return {
    subject: certificate.subject,
    issuer: certificate.issuer,
    serialNumber: certificate.serialNumber,
    validFrom: certificate.validFrom,
    validTo: certificate.validTo,
    validityStatus: validityStatus(now, startsAt, expiresAt),
    isSelfIssued: certificate.subject === certificate.issuer,
  };
}

async function verifyCertificateSignature(
  certificate: ParsedCertificate,
  issuer: ParsedCertificate,
): Promise<boolean | null> {
  const verified = await verifyDerSignature({
    signature: certificate.signature,
    signatureAlgorithmOid: certificate.signatureAlgorithmOid,
    spkiDer: issuer.publicKey.spkiDer,
    tbsDer: certificate.tbsDer,
  });

  return verified === 'not verified' ? null : verified;
}

const ecdsaCoordinateBytes: Record<string, number> = { 'P-256': 32, 'P-384': 48, 'P-521': 66 };

export async function verifyDerSignature(input: {
  signature: Uint8Array;
  signatureAlgorithmOid: string;
  spkiDer: Uint8Array;
  tbsDer: Uint8Array;
}): Promise<boolean | 'not verified'> {
  const hash = webCryptoSignatureHash(input.signatureAlgorithmOid);
  const subtle = globalThis.crypto?.subtle;
  const publicKey = publicKeyInfo(input.spkiDer);
  const ecdsa = input.signatureAlgorithmOid.startsWith('1.2.840.10045.4.');
  const namedCurve = String(publicKey.details.namedCurve);
  const coordinateBytes = ecdsaCoordinateBytes[namedCurve] ?? 0;

  if (
    !hash ||
    !subtle ||
    publicKey.algorithm !== (ecdsa ? 'ec' : 'rsa') ||
    (ecdsa && coordinateBytes === 0)
  )
    return 'not verified';

  const algorithm = ecdsa
    ? { hash, name: 'ECDSA', namedCurve }
    : { hash, name: 'RSASSA-PKCS1-v1_5' };
  const signature = ecdsa ? ecdsaRawSignature(input.signature, coordinateBytes) : input.signature;

  if (!signature) return false;

  try {
    const key = await subtle.importKey('spki', toArrayBuffer(input.spkiDer), algorithm, false, [
      'verify',
    ]);

    return await subtle.verify(
      algorithm,
      key,
      toArrayBuffer(signature),
      toArrayBuffer(input.tbsDer),
    );
  } catch {
    return 'not verified';
  }
}

function ecdsaRawSignature(der: Uint8Array, size: number): Uint8Array | undefined {
  try {
    const sequence = parseAsn1(der);
    const parts = sequence.children.map((child) => {
      const bytes = valueBytes(child);

      return bytes.subarray(bytes.findIndex((byte) => byte !== 0));
    });

    if (
      sequence.tag !== 0x30 ||
      parts.length !== 2 ||
      sequence.children.some((child) => child.tag !== 0x02) ||
      parts.some((part) => part.length > size)
    )
      return undefined;

    const raw = new Uint8Array(size * 2);

    parts.forEach((part, index) => raw.set(part, (index + 1) * size - part.length));

    return raw;
  } catch {
    return undefined;
  }
}
