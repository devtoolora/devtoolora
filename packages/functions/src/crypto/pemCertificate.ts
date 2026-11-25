import {
  ascii,
  bitStringBytes,
  ecCurveNames,
  hex,
  oid,
  oidName,
  parseAsn1,
  pemBytes,
  pemError,
  rsaBitsFromBytes,
  textValue,
  timeString,
  utcStringTime,
  valueBytes,
  type Asn1Node,
} from './pemAsn1';

const CERTIFICATE_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

export type ParsedCertificate = {
  der: Uint8Array;
  issuer: string;
  publicKey: {
    algorithm?: string;
    details: Record<string, string | number>;
    spkiDer: Uint8Array;
  };
  serialNumber: string;
  signature: Uint8Array;
  signatureAlgorithmOid: string;
  subject: string;
  subjectAltName?: string;
  tbsDer: Uint8Array;
  validFrom: string;
  validTo: string;
};

export function parseCertificates(source: string): ParsedCertificate[] {
  const blocks = source.match(CERTIFICATE_BLOCK) ?? [];

  if (blocks.length === 0) {
    throw pemError('No PEM certificate blocks were found.');
  }

  if (blocks.length > 32) throw pemError('At most 32 certificates are supported in one bundle.');

  return blocks.map((block) => parseCertificate(pemBytes(block, 'CERTIFICATE')));
}

export function parseCertificate(der: Uint8Array): ParsedCertificate {
  const root = parseAsn1(der);
  const [tbs, signatureAlgorithm, signatureValue] = root.children;

  if (
    root.tag !== 0x30 ||
    root.children.length !== 3 ||
    !tbs ||
    tbs.tag !== 0x30 ||
    !signatureAlgorithm ||
    signatureAlgorithm.tag !== 0x30 ||
    !signatureValue ||
    signatureValue.tag !== 0x03
  ) {
    throw pemError('Unable to parse PEM certificate.');
  }

  const tbsChildren = tbs.children;
  let offset = tbsChildren[0]?.tag === 0xa0 ? 1 : 0;
  const serial = tbsChildren[offset++];

  offset += 1;
  const issuer = tbsChildren[offset++];
  const validity = tbsChildren[offset++];
  const subject = tbsChildren[offset++];
  const spki = tbsChildren[offset++];

  if (
    !serial ||
    serial.tag !== 0x02 ||
    !issuer ||
    issuer.tag !== 0x30 ||
    !validity ||
    validity.tag !== 0x30 ||
    !subject ||
    subject.tag !== 0x30 ||
    !spki ||
    spki.tag !== 0x30
  ) {
    throw pemError('Unable to parse PEM certificate.');
  }

  const validFrom = timeString(validity.children[0]);
  const validTo = timeString(validity.children[1]);

  if (utcStringTime(validFrom) > utcStringTime(validTo))
    throw pemError('Certificate expiry precedes its start date.');

  return {
    der,
    tbsDer: der.slice(tbs.start, tbs.end),
    signature: bitStringBytes(signatureValue),
    signatureAlgorithmOid: oid(signatureAlgorithm.children[0]),
    subject: nameString(subject),
    issuer: nameString(issuer),
    serialNumber: serialNumberHex(valueBytes(serial)),
    validFrom,
    validTo,
    subjectAltName: subjectAltName(tbs),
    publicKey: publicKeyInfo(der.slice(spki.start, spki.end)),
  };
}

/** A leading zero before a high bit is DER's sign byte, not part of the serial number. */
function serialNumberHex(bytes: Uint8Array): string {
  return hex(bytes[0] === 0 && (bytes[1] ?? 0) >= 0x80 ? bytes.subarray(1) : bytes).toUpperCase();
}

export function publicKeyInfo(spkiDer: Uint8Array): ParsedCertificate['publicKey'] {
  const spki = parseAsn1(spkiDer);

  if (
    spki.tag !== 0x30 ||
    spki.children.length !== 2 ||
    spki.children[0]?.tag !== 0x30 ||
    spki.children[1]?.tag !== 0x03
  )
    throw pemError('Invalid SPKI public key.');

  const algorithmOid = oid(spki.children[0]?.children[0]);
  const keyBytes = bitStringBytes(spki.children[1]);
  const details: Record<string, string | number> = {};

  if (algorithmOid === '1.2.840.113549.1.1.1') {
    const rsa = parseAsn1(keyBytes);

    details.modulusLength = rsaBitsFromBytes(valueBytes(rsa.children[0]));

    return { algorithm: 'rsa', details, spkiDer };
  }

  if (algorithmOid === '1.2.840.10045.2.1') {
    const curve = spki.children[0]?.children[1];
    const curveOid = oid(curve);

    details.namedCurve =
      curve?.tag === 0x06 ? (ecCurveNames[curveOid] ?? curveOid) : 'explicit parameters';

    return { algorithm: 'ec', details, spkiDer };
  }

  return { algorithm: algorithmOid, details, spkiDer };
}

export function privateKeyAlgorithm(bytes: Uint8Array, label: string): string {
  const key = parseAsn1(bytes);

  if (key.tag !== 0x30) throw pemError('Invalid private key container.');

  if (label === 'RSA PRIVATE KEY') {
    if (key.children.length < 9 || key.children.slice(0, 9).some((child) => child.tag !== 0x02))
      throw pemError('Invalid PKCS#1 private key.');

    return 'rsa';
  }

  if (label === 'EC PRIVATE KEY') {
    if (key.children[0]?.tag !== 0x02 || key.children[1]?.tag !== 0x04)
      throw pemError('Invalid SEC1 private key.');

    return 'ec';
  }

  if (
    key.children[0]?.tag !== 0x02 ||
    key.children[1]?.tag !== 0x30 ||
    key.children[2]?.tag !== 0x04
  )
    throw pemError('Invalid PKCS#8 private key.');

  const oidValue = oid(key.children[1]?.children[0]);

  if (oidValue === '1.2.840.113549.1.1.1') return 'rsa';
  if (oidValue === '1.2.840.10045.2.1') return 'ec';

  return oidValue || 'private';
}

function subjectAltName(tbs: Asn1Node): string | undefined {
  const extensionWrapper = tbs.children.find((child) => child.tag === 0xa3);
  const extensions = extensionWrapper?.children[0]?.children ?? [];
  const san = extensions.find((extension) => oid(extension.children[0]) === '2.5.29.17');
  const octets = san?.children.find((child) => child.tag === 0x04);

  if (!octets) {
    return undefined;
  }

  const names = generalNames(valueBytes(octets));

  return names.length > 0 ? names.join(', ') : undefined;
}

export function generalNames(der: Uint8Array): string[] {
  // GeneralName context tags (RFC 5280): [0] otherName, [1] rfc822Name, [2] dNSName,
  // [4] directoryName, [6] URI, [7] iPAddress, [8] registeredID.
  return parseAsn1(der).children.map((entry) => {
    if (entry.tag === 0xa0) return otherNameText(entry);
    if (entry.tag === 0x81) return `email:${ascii(valueBytes(entry))}`;
    if (entry.tag === 0x82) return `DNS:${ascii(valueBytes(entry))}`;
    if (entry.tag === 0xa4 && entry.children[0]?.tag === 0x30)
      return `DirName:${nameParts(entry.children[0])
        .map((part) => `/${part}`)
        .join('')}`;
    if (entry.tag === 0x86) return `URI:${ascii(valueBytes(entry))}`;
    if (entry.tag === 0x87) return `IP:${ipAddressText(valueBytes(entry))}`;
    if (entry.tag === 0x88) return `RID:${oid(entry)}`;

    return `GeneralName[${entry.tag & 0x1f}]`;
  });
}

const directoryStringTags = [0x0c, 0x13, 0x14, 0x16, 0x1a, 0x1e];

function otherNameText(entry: Asn1Node): string {
  const [typeId, wrapper] = entry.children;
  const value = wrapper?.children[0];
  const text = value && directoryStringTags.includes(value.tag) ? `:${textValue(value)}` : '';

  return `otherName:${oid(typeId)}${text}`;
}

function ipAddressText(bytes: Uint8Array): string {
  if (bytes.length === 4) return [...bytes].join('.');
  if (bytes.length !== 16) return hex(bytes);
  if (bytes.subarray(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff)
    return `::ffff:${[...bytes.subarray(12)].join('.')}`;

  const groups = Array.from({ length: 8 }, (_value, index) =>
    ((bytes[index * 2]! << 8) | bytes[index * 2 + 1]!).toString(16),
  );
  // RFC 5952: shorten the first longest run of two or more zero groups to ::.
  let runStart = -1;
  let runLength = 1;

  for (let index = 0; index < 8;) {
    let end = index;

    while (end < 8 && groups[end] === '0') end += 1;
    if (end - index > runLength) [runStart, runLength] = [index, end - index];

    index = Math.max(end, index + 1);
  }

  return runStart < 0
    ? groups.join(':')
    : `${groups.slice(0, runStart).join(':')}::${groups.slice(runStart + runLength).join(':')}`;
}

export function nameString(node: Asn1Node): string {
  return nameParts(node).join('\n');
}

function nameParts(node: Asn1Node): string[] {
  return node.children.flatMap((set) =>
    set.children.map((item) => {
      const [id, value] = item.children;

      return `${oidName(oid(id))}=${textValue(value)}`;
    }),
  );
}
