import { sortFindings, type Finding } from '../web/findings';
import { verifyDerSignature } from './pem';
import {
  bitStringBytes,
  fingerprint,
  oid,
  oidName,
  parseAsn1,
  pemBlocks,
  pemError,
  requiredPem,
  signatureAlgorithmName,
  textValue,
  valueBytes,
  webCryptoSignatureHash,
  type Asn1Node,
} from './pemAsn1';
import { generalNames, publicKeyInfo } from './pemCertificate';

export type CsrReport = {
  attributes: string[];
  challengePassword: boolean;
  extensions: {
    basicConstraints?: string;
    extendedKeyUsage?: string[];
    keyUsage?: string[];
    subjectAltNames: string[];
  };
  findings: Finding[];
  fingerprintSha256: string;
  publicKey: { algorithm?: string; details: Record<string, string | number> };
  signatureAlgorithm: string;
  signatureValid: boolean | 'not verified';
  subject: string;
  subjectAttributes: Array<{ name: string; value: string }>;
  version: number;
};

type ParsedCsr = {
  attributes: Asn1Node[];
  signature: Uint8Array;
  signatureAlgorithmOid: string;
  spkiDer: Uint8Array;
  subject: Asn1Node;
  tbsDer: Uint8Array;
  version: number;
};

const csrLabels = ['CERTIFICATE REQUEST', 'NEW CERTIFICATE REQUEST'];
const challengePasswordOid = '1.2.840.113549.1.9.7';
const extensionRequestOid = '1.2.840.113549.1.9.14';
const keyUsageBits = [
  'digitalSignature',
  'nonRepudiation',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'encipherOnly',
  'decipherOnly',
];
const extendedKeyUsageNames: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'serverAuth',
  '1.3.6.1.5.5.7.3.2': 'clientAuth',
  '1.3.6.1.5.5.7.3.3': 'codeSigning',
  '1.3.6.1.5.5.7.3.4': 'emailProtection',
};

export async function decodeCsr(source: string): Promise<CsrReport> {
  const block = pemBlocks(requiredPem(source, 'CSR')).find((candidate) =>
    csrLabels.includes(candidate.label),
  );

  if (!block) throw pemError('Paste a PEM CERTIFICATE REQUEST block.');

  let csr: ParsedCsr;
  let extensions: CsrReport['extensions'];
  let publicKey: CsrReport['publicKey'];

  try {
    csr = parseCsr(block.bytes);
    extensions = requestedExtensions(csr.attributes);
    publicKey = publicKeyReport(csr.spkiDer);
  } catch (error) {
    throw pemError(
      `The ${block.label} block is not valid DER: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const subjectAttributes = csr.subject.children.flatMap(rdnAttributes);
  const attributeOids = csr.attributes.map((attribute) => oid(attribute.children[0]));
  const challengePassword = attributeOids.includes(challengePasswordOid);

  return {
    subject: csr.subject.children
      .map((rdn) =>
        rdnAttributes(rdn)
          .map(({ name, value }) => `${name}=${value}`)
          .join('+'),
      )
      .join(', '),
    subjectAttributes,
    publicKey,
    signatureAlgorithm: signatureAlgorithmName(csr.signatureAlgorithmOid),
    signatureValid: await verifyDerSignature(csr),
    extensions,
    attributes: attributeOids
      .filter((value) => value !== challengePasswordOid && value !== extensionRequestOid)
      .map(oidName),
    challengePassword,
    fingerprintSha256: await fingerprint(block.bytes, 'sha256'),
    version: csr.version,
    findings: csrFindings({
      challengePassword,
      commonName: subjectAttributes.find((attribute) => attribute.name === 'CN')?.value,
      publicKey,
      sha1: webCryptoSignatureHash(csr.signatureAlgorithmOid) === 'SHA-1',
      subjectAltNames: extensions.subjectAltNames,
    }),
  };
}

function parseCsr(der: Uint8Array): ParsedCsr {
  const root = parseAsn1(der);
  const [info, algorithm, signature] = root.children;
  const [version, subject, spki, attributes] = info?.children ?? [];

  if (
    root.tag !== 0x30 ||
    root.children.length !== 3 ||
    info?.tag !== 0x30 ||
    algorithm?.tag !== 0x30 ||
    signature?.tag !== 0x03 ||
    version?.tag !== 0x02 ||
    subject?.tag !== 0x30 ||
    spki?.tag !== 0x30 ||
    (attributes && attributes.tag !== 0xa0)
  )
    throw pemError('Expected a PKCS#10 CertificationRequest structure.');

  return {
    attributes: attributes?.children ?? [],
    signature: bitStringBytes(signature),
    signatureAlgorithmOid: oid(algorithm.children[0]),
    spkiDer: der.slice(spki.start, spki.end),
    subject,
    tbsDer: der.slice(info.start, info.end),
    version: valueBytes(version)[0] ?? 0,
  };
}

function rdnAttributes(rdn: Asn1Node): CsrReport['subjectAttributes'] {
  return rdn.children.map((item) => ({
    name: oidName(oid(item.children[0])),
    value: textValue(item.children[1]),
  }));
}

function publicKeyReport(spkiDer: Uint8Array): CsrReport['publicKey'] {
  const { algorithm, details } = publicKeyInfo(spkiDer);

  if (algorithm === 'rsa')
    return { algorithm: 'RSA', details: { bits: details.modulusLength ?? 0 } };
  if (algorithm === 'ec') return { algorithm: 'EC', details: { curve: details.namedCurve ?? '' } };

  return { algorithm, details };
}

function requestedExtensions(attributes: Asn1Node[]): CsrReport['extensions'] {
  const request = attributes.find(
    (attribute) => oid(attribute.children[0]) === extensionRequestOid,
  );
  const report: CsrReport['extensions'] = { subjectAltNames: [] };

  for (const extension of request?.children[1]?.children[0]?.children ?? []) {
    const id = oid(extension.children[0]);
    const value = valueBytes(extension.children.at(-1));

    if (id === '2.5.29.17') report.subjectAltNames = generalNames(value);
    if (id === '2.5.29.15') report.keyUsage = keyUsage(bitStringBytes(parseAsn1(value)));
    if (id === '2.5.29.37')
      report.extendedKeyUsage = parseAsn1(value).children.map(
        (child) => extendedKeyUsageNames[oid(child)] ?? oid(child),
      );
    if (id === '2.5.29.19') report.basicConstraints = basicConstraintsText(value);
  }

  return report;
}

function basicConstraintsText(der: Uint8Array): string {
  const { children } = parseAsn1(der);
  const [first] = children;
  const ca = first?.tag === 0x01 && valueBytes(first)[0] ? 'CA:TRUE' : 'CA:FALSE';
  const pathLength = children.find((child) => child.tag === 0x02);

  return pathLength
    ? `${ca}, pathlen:${valueBytes(pathLength).reduce((sum, byte) => sum * 256 + byte, 0)}`
    : ca;
}

function keyUsage(bits: Uint8Array): string[] {
  return keyUsageBits.filter((_name, index) => (bits[index >> 3] ?? 0) & (0x80 >> (index & 7)));
}

function csrFindings(input: {
  challengePassword: boolean;
  commonName?: string;
  publicKey: CsrReport['publicKey'];
  sha1: boolean;
  subjectAltNames: string[];
}): Finding[] {
  const findings: Finding[] = [];
  const bits = Number(input.publicKey.details.bits);
  const commonName = input.commonName?.toLowerCase();

  if (input.publicKey.algorithm === 'RSA' && bits < 2048)
    findings.push({
      level: 'medium',
      message: `The RSA key has ${bits.toLocaleString('en-US')} bits; use at least 2,048.`,
    });
  if (input.subjectAltNames.length === 0)
    findings.push({ level: 'medium', message: 'No subjectAltName; browsers ignore the CN.' });
  else if (
    commonName &&
    !input.subjectAltNames.some(
      (name) => name.toLowerCase().replace(/^(dns|ip):/, '') === commonName,
    )
  )
    findings.push({ level: 'low', message: 'The CN is not listed in the subjectAltName.' });
  if (input.sha1)
    findings.push({
      level: 'high',
      message: 'Signed with SHA-1; certificate authorities reject it.',
    });
  if (input.challengePassword)
    findings.push({
      level: 'info',
      message: 'The request carries a challengePassword attribute.',
    });

  return sortFindings(findings);
}
