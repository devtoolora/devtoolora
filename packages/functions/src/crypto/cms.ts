import { FunctionError } from '../errors';
import {
  fingerprint,
  hex,
  oid,
  parseAsn1,
  signatureAlgorithmName,
  timeString,
  utcStringTime,
  valueBytes,
  type Asn1Node,
} from './pemAsn1';
import { nameString, parseCertificate, type ParsedCertificate } from './pemCertificate';

const SIGNED_DATA = '1.2.840.113549.1.7.2';
const MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const SIGNING_TIME = '1.2.840.113549.1.9.5';
const SIGNING_CERTIFICATE_V2 = '1.2.840.113549.1.9.16.2.47';
const TIMESTAMP_TOKEN = '1.2.840.113549.1.9.16.2.14';
const MAX_ENTRIES = 32;

const digestNames = new Map([
  ['1.3.14.3.2.26', 'SHA-1'],
  ['2.16.840.1.101.3.4.2.4', 'SHA-224'],
  ['2.16.840.1.101.3.4.2.1', 'SHA-256'],
  ['2.16.840.1.101.3.4.2.2', 'SHA-384'],
  ['2.16.840.1.101.3.4.2.3', 'SHA-512'],
  ['2.16.840.1.101.3.4.2.7', 'SHA3-224'],
  ['2.16.840.1.101.3.4.2.8', 'SHA3-256'],
  ['2.16.840.1.101.3.4.2.9', 'SHA3-384'],
  ['2.16.840.1.101.3.4.2.10', 'SHA3-512'],
]);

export type CmsSigner = {
  certificate?: {
    fingerprintSha256: string;
    issuer: string;
    key: string;
    notAfter: string;
    notBefore: string;
    selfSigned: boolean;
    serial: string;
    subject: string;
  };
  digestAlgorithm: string;
  hasMessageDigest: boolean;
  hasSigningCertificateV2: boolean;
  hasTimestamp: boolean;
  signatureAlgorithm: string;
  signingTime?: string;
};

/** Reads signers and certificates from a (BER or DER) CMS SignedData; nothing is verified. */
export async function decodeCmsSignedData(bytes: Uint8Array): Promise<{
  certificates: string[];
  signerCertificates: Array<Uint8Array | undefined>;
  signers: CmsSigner[];
}> {
  // parseAsn1 reads one top-level value, so the zero padding of a PDF /Contents is ignored.
  const root = parseAsn1(bytes, { ber: true });
  const signedData = root.children[1]?.children[0];

  if (
    root.tag !== 0x30 ||
    oid(root.children[0]) !== SIGNED_DATA ||
    root.children[1]?.tag !== 0xa0 ||
    signedData?.tag !== 0x30
  )
    throw cmsError('The signature is not a CMS SignedData structure.');

  const certificateNodes = (
    signedData.children.find((child) => child.tag === 0xa0)?.children ?? []
  ).filter((child) => child.tag === 0x30);
  const signerInfos = signedData.children.at(-1);

  if (signerInfos?.tag !== 0x31) throw cmsError('The CMS SignedData has no signer infos.');
  if (certificateNodes.length > MAX_ENTRIES || signerInfos.children.length > MAX_ENTRIES)
    throw cmsError(`A CMS signature may hold at most ${MAX_ENTRIES} certificates and signers.`);

  const certificates = certificateNodes.map((node) =>
    parseCertificate(bytes.slice(node.start, node.end)),
  );

  const decoded = await Promise.all(
    signerInfos.children.map((info) => decodeSigner(info, certificates)),
  );

  return {
    certificates: certificates.map((certificate) => certificate.subject),
    signerCertificates: decoded.map((entry) => entry.certificate?.der),
    signers: decoded.map((entry) => entry.signer),
  };
}

async function decodeSigner(
  info: Asn1Node,
  certificates: ParsedCertificate[],
): Promise<{ certificate?: ParsedCertificate; signer: CmsSigner }> {
  const [, sid, digest, ...rest] = info.children;
  const signedAttributes = rest[0]?.tag === 0xa0 ? rest.shift() : undefined;
  const [signatureAlgorithm, signature, unsignedAttributes] = rest;

  if (
    info.tag !== 0x30 ||
    !sid ||
    digest?.tag !== 0x30 ||
    signatureAlgorithm?.tag !== 0x30 ||
    (signature?.tag !== 0x04 && signature?.tag !== 0x24)
  )
    throw cmsError('Invalid CMS SignerInfo.');

  const signed = attributes(signedAttributes);
  const unsigned = attributes(unsignedAttributes?.tag === 0xa1 ? unsignedAttributes : undefined);
  const digestOid = oid(digest.children[0]);
  const certificate = certificates.find((candidate) => matchesSid(candidate, sid));
  const signingTime = signingTimeOf(signed.get(SIGNING_TIME));

  return {
    certificate,
    signer: {
      ...(certificate && { certificate: await certificateSummary(certificate) }),
      digestAlgorithm: digestNames.get(digestOid) ?? digestOid,
      hasMessageDigest: signed.has(MESSAGE_DIGEST),
      hasSigningCertificateV2: signed.has(SIGNING_CERTIFICATE_V2),
      hasTimestamp: unsigned.has(TIMESTAMP_TOKEN),
      signatureAlgorithm: signatureAlgorithmName(oid(signatureAlgorithm.children[0])),
      ...(signingTime && { signingTime }),
    },
  };
}

function attributes(node: Asn1Node | undefined): Map<string, Asn1Node> {
  return new Map(
    (node?.children ?? []).flatMap((attribute) => {
      const [type, values] = attribute.children;

      return values ? [[oid(type), values] as const] : [];
    }),
  );
}

function matchesSid(certificate: ParsedCertificate, sid: Asn1Node): boolean {
  if (sid.tag === 0x80) {
    const keyId = hex(valueBytes(sid));

    return keyId !== '' && keyId === subjectKeyIdentifier(certificate);
  }

  const [issuer, serial] = sid.children;

  return (
    sid.tag === 0x30 &&
    issuer?.tag === 0x30 &&
    nameString(issuer) === certificate.issuer &&
    hex(valueBytes(serial)).toUpperCase() === certificate.serialNumber
  );
}

function subjectKeyIdentifier(certificate: ParsedCertificate): string {
  const extensions =
    parseAsn1(certificate.tbsDer).children.find((child) => child.tag === 0xa3)?.children[0]
      ?.children ?? [];
  const extension = extensions.find((candidate) => oid(candidate.children[0]) === '2.5.29.14');
  const octets = extension?.children.at(-1);

  return octets?.tag === 0x04 ? hex(valueBytes(parseAsn1(valueBytes(octets)))) : '';
}

export async function certificateSummary(
  certificate: ParsedCertificate,
): Promise<NonNullable<CmsSigner['certificate']>> {
  return {
    fingerprintSha256: await fingerprint(certificate.der, 'sha256'),
    issuer: certificate.issuer,
    key: keyText(certificate.publicKey),
    notAfter: isoTime(certificate.validTo),
    notBefore: isoTime(certificate.validFrom),
    selfSigned: certificate.subject === certificate.issuer,
    serial: certificate.serialNumber.toLowerCase(),
    subject: certificate.subject,
  };
}

function keyText({ algorithm = '', details }: ParsedCertificate['publicKey']): string {
  if (algorithm === 'ec') return `EC ${details.namedCurve}`;
  if (algorithm === 'rsa') return `RSA ${details.modulusLength}`;

  return algorithm;
}

function signingTimeOf(values: Asn1Node | undefined): string | undefined {
  try {
    return values ? isoTime(timeString(values.children[0])) : undefined;
  } catch {
    return undefined;
  }
}

function isoTime(utc: string): string {
  const time = utcStringTime(utc);

  return Number.isNaN(time) ? utc : new Date(time).toISOString().replace('.000Z', 'Z');
}

function cmsError(message: string): FunctionError {
  return new FunctionError('INVALID_CMS', message);
}
