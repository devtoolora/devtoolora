import { utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { decodeBase64Url, der, hexBytes, keyError, tlv } from './jwtKeyEncoding';
import type { JwtKey, JwtSecretEncoding } from './jwtKeys';
import {
  ecCurveNames,
  keyPemBlocks,
  oid,
  parseAsn1,
  parseCertificate,
  rsaBitsFromBytes,
  valueBytes,
  type Asn1Node,
} from './pem';

const keyOids: Record<string, { curve?: string; pss?: boolean; type: JwtKey['type'] }> = {
  '1.2.840.113549.1.1.1': { type: 'RSA' },
  '1.2.840.113549.1.1.10': { pss: true, type: 'RSA' },
  '1.2.840.10045.2.1': { type: 'EC' },
  '1.3.101.110': { curve: 'X25519', type: 'OKP' },
  '1.3.101.111': { curve: 'X448', type: 'OKP' },
  '1.3.101.112': { curve: 'Ed25519', type: 'OKP' },
  '1.3.101.113': { curve: 'Ed448', type: 'OKP' },
};
const rsaAlgorithmIdentifier = hexBytes('300d06092a864886f70d0101010500');
const ecPublicKeyOid = hexBytes('06072a8648ce3d0201');
const privateJwkMembers = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];
const secretEncodingLabels: Record<JwtSecretEncoding, string> = {
  base64: 'Base64',
  hex: 'hex',
  utf8: 'UTF-8 text',
};

export function secretKey(source: string, encoding: JwtSecretEncoding): JwtKey {
  let bytes: Uint8Array;

  if (encoding === 'utf8') bytes = utf8Bytes(source);
  else if (encoding === 'hex') {
    const hex = source.replace(/\s+/g, '').replace(/^0x/i, '');

    if (!/^(?:[0-9a-f]{2})+$/i.test(hex))
      throw keyError('Hex secrets need an even number of 0-9 and a-f digits.');

    bytes = hexBytes(hex);
  } else {
    const base64 = source.replace(/\s+/g, '');

    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(base64))
      throw keyError(
        'Base64 secrets may contain only A-Z, a-z, 0-9, + / or - _ and trailing = padding.',
      );

    bytes = decodeBase64Url(base64.replace(/(?<!=)=+$/, ''), 'Secret');
  }

  if (bytes.length === 0) throw keyError('Enter the secret or key.');

  return {
    bits: bytes.length * 8,
    bytes,
    description: `HMAC secret · ${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'} from ${secretEncodingLabels[encoding] ?? 'Base64'}`,
    format: 'raw',
    isPrivate: true,
    type: 'oct',
  };
}

type PemBlock = ReturnType<typeof keyPemBlocks>[number];

export function pemKey(input: string): JwtKey {
  const blocks = keyPemBlocks(input);

  const [block] = blocks;

  if (!block) throw keyError('The PEM text has no matching BEGIN and END lines.');

  const certificates = blocks.filter((block) => block.label === 'CERTIFICATE');

  if (blocks.length > 1 && certificates.length !== blocks.length)
    throw keyError(
      'Paste exactly one PEM key, or a certificate chain whose first certificate holds the key.',
    );

  if (block.label === 'ENCRYPTED PRIVATE KEY' || /Proc-Type:\s*4,ENCRYPTED/i.test(input)) {
    throw keyError(
      'Encrypted private keys need their passphrase. Decrypt a copy first, for example: openssl pkey -in key.pem -out plain-key.pem',
    );
  }

  if (block.label === 'OPENSSH PRIVATE KEY')
    throw keyError(
      'OpenSSH private keys are not supported. Convert a copy to PKCS#8 with: ssh-keygen -p -m PKCS8 -f key',
    );

  try {
    const key = keyFromPemBlock(block, certificates.length);

    if (key) return key;
  } catch (error) {
    if (error instanceof FunctionError && error.code === 'INVALID_JWT_KEY') throw error;

    throw keyError(
      `The ${block.label} block is not valid DER: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  throw keyError(
    `Unsupported PEM block "${block.label}". Use PUBLIC KEY, PRIVATE KEY, RSA/EC PRIVATE KEY or CERTIFICATE.`,
  );
}

function keyFromPemBlock(block: PemBlock, certificateCount: number): JwtKey | undefined {
  if (block.label === 'PUBLIC KEY') return spkiKey(block.bytes, 'PEM');
  if (block.label === 'CERTIFICATE')
    return spkiKey(
      parseCertificate(block.bytes).publicKey.spkiDer,
      certificateCount > 1 ? `certificate 1 of ${certificateCount}` : 'certificate',
    );
  if (block.label === 'RSA PUBLIC KEY')
    return spkiKey(
      der(0x30, rsaAlgorithmIdentifier, der(0x03, new Uint8Array([0]), block.bytes)),
      'PKCS#1 PEM',
    );
  if (block.label === 'PRIVATE KEY') return pkcs8Key(block.bytes, 'PEM');
  if (block.label === 'RSA PRIVATE KEY')
    return pkcs8Key(
      der(0x30, hexBytes('020100'), rsaAlgorithmIdentifier, der(0x04, block.bytes)),
      'PKCS#1 PEM',
    );
  if (block.label === 'EC PRIVATE KEY') return sec1Key(block.bytes);

  return undefined;
}

function sec1Key(bytes: Uint8Array): JwtKey {
  const curve = parseAsn1(bytes).children.find((child) => child.tag === 0xa0)?.children[0];

  if (!curve || curve.tag !== 0x06) throw keyError('This EC PRIVATE KEY does not name its curve.');

  return pkcs8Key(
    der(0x30, hexBytes('020100'), der(0x30, ecPublicKeyOid, tlv(curve)), der(0x04, bytes)),
    'SEC1 PEM',
  );
}

function spkiKey(spkiDer: Uint8Array, source: string): JwtKey {
  const spki = parseAsn1(spkiDer);
  const algorithm = spki.children[0];

  if (spki.tag !== 0x30 || algorithm?.tag !== 0x30 || spki.children[1]?.tag !== 0x03)
    throw keyError('Invalid public key structure.');

  const info = keyInfo(algorithm);
  const bits =
    info.type === 'RSA'
      ? rsaBits(parseAsn1(valueBytes(spki.children[1]).slice(1)).children[0])
      : undefined;

  return {
    ...info,
    bits,
    der: spkiDer,
    description: describe({ ...info, bits, isPrivate: false }, source),
    format: 'spki',
    isPrivate: false,
  };
}

function pkcs8Key(pkcs8Der: Uint8Array, source: string): JwtKey {
  const pkcs8 = parseAsn1(pkcs8Der);
  const algorithm = pkcs8.children[1];

  if (
    pkcs8.tag !== 0x30 ||
    pkcs8.children[0]?.tag !== 0x02 ||
    algorithm?.tag !== 0x30 ||
    pkcs8.children[2]?.tag !== 0x04
  )
    throw keyError('Invalid private key structure.');

  const info = keyInfo(algorithm);
  const bits =
    info.type === 'RSA' ? rsaBits(parseAsn1(valueBytes(pkcs8.children[2])).children[1]) : undefined;

  return {
    ...info,
    bits,
    der: pkcs8Der,
    description: describe({ ...info, bits, isPrivate: true }, source),
    format: 'pkcs8',
    isPrivate: true,
  };
}

function keyInfo(algorithm: Asn1Node): { curve?: string; pss?: boolean; type: JwtKey['type'] } {
  const algorithmOid = oid(algorithm.children[0]);
  const info = keyOids[algorithmOid];

  if (!info) throw keyError(`Unsupported key algorithm (OID ${algorithmOid}).`);
  if (info.type !== 'EC') return info;

  if (algorithm.children[1]?.tag !== 0x06) throw keyError('This EC key does not name its curve.');

  const curveOid = oid(algorithm.children[1]);

  return { curve: ecCurveNames[curveOid] ?? `curve ${curveOid}`, type: 'EC' };
}

export function jwkKey(value: unknown, kid: unknown): JwtKey {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw keyError('A JWK must be a JSON object.');

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.keys)) return jwkKey(selectJwk(record.keys, kid), undefined);

  const jwk = record as JsonWebKey & { kid?: string };

  if (jwk.kty === 'oct') {
    if (typeof jwk.k !== 'string' || !jwk.k) throw keyError('An oct JWK needs its secret in "k".');

    const bytes = decodeBase64Url(jwk.k, 'JWK "k"');

    return {
      bits: bytes.length * 8,
      bytes,
      description: `HMAC secret · ${bytes.length} bytes from JWK${kidLabel(jwk)}`,
      format: 'raw',
      isPrivate: true,
      jwk,
      type: 'oct',
    };
  }

  if (jwk.kty !== 'RSA' && jwk.kty !== 'EC' && jwk.kty !== 'OKP')
    throw keyError('The JWK needs "kty" set to RSA, EC, OKP or oct.');
  if (jwk.use === 'enc')
    throw keyError('This JWK has "use": "enc", so it is for encryption, not signatures.');

  const type: JwtKey['type'] = jwk.kty;
  const isPrivate = typeof jwk.d === 'string';
  const curve = type === 'RSA' ? undefined : jwk.crv;

  if (type !== 'RSA' && !curve) throw keyError(`An ${type} JWK needs "crv".`);

  const bits =
    type === 'RSA' && typeof jwk.n === 'string'
      ? rsaBitsFromBytes(decodeBase64Url(jwk.n, 'JWK "n"'))
      : undefined;

  if (type === 'RSA' && bits === undefined) throw keyError('An RSA JWK needs its modulus in "n".');

  const info = { bits, curve, isPrivate, type };

  return {
    ...info,
    description: describe(info, `JWK${kidLabel(jwk)}`),
    format: 'jwk',
    isPrivate,
    jwk,
    type,
  };
}

function selectJwk(keys: unknown[], kid: unknown): unknown {
  const usable = keys.filter(
    (key) => key && typeof key === 'object' && (key as JsonWebKey).use !== 'enc',
  ) as Array<JsonWebKey & { kid?: string }>;

  if (typeof kid === 'string' && kid) {
    const match = usable.find((key) => key.kid === kid);

    if (match) return match;

    const available = usable
      .map((key) => key.kid)
      .filter(Boolean)
      .join(', ');

    throw keyError(
      `The JWKS has no signing key with kid "${kid}"${available ? `; it has ${available}` : ''}.`,
    );
  }

  if (usable.length === 1) return usable[0];

  throw keyError(
    usable.length === 0
      ? 'The JWKS has no signing keys.'
      : `The JWKS has ${usable.length} signing keys and no kid selects one. Add a kid to the header or paste a single JWK.`,
  );
}

export function importableJwk(jwk: JsonWebKey): JsonWebKey {
  const { alg: _alg, key_ops: _keyOps, use: _use, ...rest } = jwk as JsonWebKey & { kid?: string };

  return { ...rest, ext: true };
}

export function publicJwk(jwk: JsonWebKey): JsonWebKey {
  const copy: Record<string, unknown> = { ...importableJwk(jwk) };

  for (const member of privateJwkMembers) delete copy[member];

  return copy as JsonWebKey;
}

function describe(
  key: { bits?: number; curve?: string; isPrivate: boolean; type: JwtKey['type'] },
  source: string,
): string {
  const size = key.type === 'RSA' && key.bits ? ` · ${key.bits}-bit` : '';

  return `${describeType(key)}${size} · ${source}`;
}

export function describeType(key: {
  curve?: string;
  isPrivate?: boolean;
  type: JwtKey['type'];
}): string {
  if (key.type === 'oct') return 'HMAC secret';

  const visibility = key.isPrivate ? 'private' : 'public';

  if (key.type === 'RSA') return `RSA ${visibility} key`;

  return `${key.curve ?? key.type} ${visibility} key`;
}

function kidLabel(jwk: { kid?: unknown }): string {
  return typeof jwk.kid === 'string' && jwk.kid ? ` kid=${jwk.kid}` : '';
}

export function article(value: string): string {
  return /^(?:RSA|HMAC|Ed|EC|X|[aeiou])/i.test(value) ? `an ${value}` : `a ${value}`;
}

export function unsupportedCurve(curve: string | undefined): FunctionError {
  return keyError(
    curve === 'secp256k1'
      ? 'secp256k1 (ES256K) keys are not available in Web Crypto.'
      : `Keys on ${curve ?? 'this curve'} cannot sign JWTs here.`,
  );
}

function rsaBits(modulus: Asn1Node | undefined): number | undefined {
  return modulus?.tag === 0x02 ? rsaBitsFromBytes(valueBytes(modulus)) : undefined;
}
