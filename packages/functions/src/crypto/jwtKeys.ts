import { FunctionError } from '../errors';
import { arrayBuffer, keyError, subtle } from './jwtKeyEncoding';
import {
  article,
  describeType,
  importableJwk,
  jwkKey,
  pemKey,
  publicJwk,
  secretKey,
  unsupportedCurve,
} from './jwtKeyParse';

export { decodeBase64Url } from './jwtKeyEncoding';

export const jwtAlgorithms = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
  'Ed25519',
] as const;
export type JwtAlgorithm = (typeof jwtAlgorithms)[number];
export type JwtSecretEncoding = 'base64' | 'hex' | 'utf8';

type Family = 'ecdsa' | 'eddsa' | 'hmac' | 'rsa' | 'rsa-pss';
type Hash = 'SHA-256' | 'SHA-384' | 'SHA-512';
type AlgorithmSpec = { bytes: number; curve?: string; family: Family; hash?: Hash };

const specs: Record<JwtAlgorithm, AlgorithmSpec> = {
  HS256: { bytes: 32, family: 'hmac', hash: 'SHA-256' },
  HS384: { bytes: 48, family: 'hmac', hash: 'SHA-384' },
  HS512: { bytes: 64, family: 'hmac', hash: 'SHA-512' },
  RS256: { bytes: 32, family: 'rsa', hash: 'SHA-256' },
  RS384: { bytes: 48, family: 'rsa', hash: 'SHA-384' },
  RS512: { bytes: 64, family: 'rsa', hash: 'SHA-512' },
  PS256: { bytes: 32, family: 'rsa-pss', hash: 'SHA-256' },
  PS384: { bytes: 48, family: 'rsa-pss', hash: 'SHA-384' },
  PS512: { bytes: 64, family: 'rsa-pss', hash: 'SHA-512' },
  ES256: { bytes: 64, curve: 'P-256', family: 'ecdsa', hash: 'SHA-256' },
  ES384: { bytes: 96, curve: 'P-384', family: 'ecdsa', hash: 'SHA-384' },
  ES512: { bytes: 132, curve: 'P-521', family: 'ecdsa', hash: 'SHA-512' },
  EdDSA: { bytes: 64, curve: 'Ed25519', family: 'eddsa' },
  Ed25519: { bytes: 64, curve: 'Ed25519', family: 'eddsa' },
};

export type JwtKey = {
  bits?: number;
  bytes?: Uint8Array;
  curve?: string;
  der?: Uint8Array;
  description: string;
  format: 'jwk' | 'pkcs8' | 'raw' | 'spki';
  isPrivate: boolean;
  jwk?: JsonWebKey & { kid?: string };
  pss?: boolean;
  type: 'EC' | 'OKP' | 'RSA' | 'oct';
};

export function isJwtAlgorithm(value: unknown): value is JwtAlgorithm {
  return typeof value === 'string' && (jwtAlgorithms as readonly string[]).includes(value);
}

export function jwtSignatureBytes(algorithm: JwtAlgorithm): number | undefined {
  const spec = specs[algorithm];

  return spec.family === 'ecdsa' || spec.family === 'eddsa' ? spec.bytes : undefined;
}

export function parseJwtKey(
  source: string,
  options: { kid?: unknown; secretEncoding?: JwtSecretEncoding } = {},
): JwtKey {
  const input = source.trim();

  if (!input) throw keyError('Enter the secret or key.');
  if (input.length > 1_048_576) throw keyError('Key input must be no larger than 1 MiB.');
  // A PEM copied out of JSON or an env file carries its line breaks as literal \\n.
  if (input.startsWith('-----BEGIN')) return pemKey(input.replace(/\\r\\n|\\n/g, '\n'));

  if (input.startsWith('{')) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(input);
    } catch {
      throw keyError('Key looks like a JWK but is not valid JSON.');
    }

    return jwkKey(parsed, options.kid);
  }

  return secretKey(source, options.secretEncoding ?? 'utf8');
}

export function inferJwtAlgorithm(key: JwtKey): JwtAlgorithm {
  if (isJwtAlgorithm(key.jwk?.alg)) return key.jwk.alg;
  if (key.type === 'oct') return 'HS256';
  if (key.type === 'RSA') return key.pss ? 'PS256' : 'RS256';
  if (key.curve === 'P-256') return 'ES256';
  if (key.curve === 'P-384') return 'ES384';
  if (key.curve === 'P-521') return 'ES512';
  if (key.curve === 'Ed25519') return 'EdDSA';

  throw unsupportedCurve(key.curve);
}

export function jwtKeyWarnings(key: JwtKey, algorithm: JwtAlgorithm): string[] {
  const spec = specs[algorithm];

  if (spec.family === 'hmac' && key.bytes && key.bytes.length < spec.bytes) {
    return [
      `${algorithm} secrets should be at least ${spec.bytes} bytes (RFC 7518 §3.2); this one is ${key.bytes.length}.`,
    ];
  }

  if (key.type === 'RSA' && key.bits !== undefined && key.bits < 2048)
    return [`The RSA key is ${key.bits}-bit; RFC 7518 requires 2048-bit or larger.`];

  return [];
}

export async function signJwtBytes(
  key: JwtKey,
  algorithm: JwtAlgorithm,
  data: Uint8Array,
): Promise<Uint8Array> {
  if (key.type !== 'oct' && !key.isPrivate) {
    throw keyError(
      `Signing with ${algorithm} needs a private key: a PRIVATE KEY PEM or a JWK with "d". This is a public key.`,
    );
  }

  const cryptoKey = await importKey(key, algorithm, 'sign');

  return new Uint8Array(
    await subtle().sign(signatureParams(algorithm), cryptoKey, arrayBuffer(data)),
  );
}

export async function verifyJwtBytes(
  key: JwtKey,
  algorithm: JwtAlgorithm,
  data: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const cryptoKey = await importKey(key, algorithm, 'verify');

  return subtle().verify(
    signatureParams(algorithm),
    cryptoKey,
    arrayBuffer(signature),
    arrayBuffer(data),
  );
}

async function importKey(
  key: JwtKey,
  algorithm: JwtAlgorithm,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> {
  const spec = specs[algorithm];

  assertCompatible(key, algorithm, spec);
  const params = importParams(spec);

  try {
    if (key.format === 'raw')
      return await subtle().importKey(
        'raw',
        arrayBuffer(key.bytes ?? new Uint8Array()),
        params,
        false,
        [usage],
      );
    if (usage === 'verify' && key.isPrivate)
      return await subtle().importKey(
        'jwk',
        publicJwk(await privateJwk(key, params)),
        params,
        false,
        ['verify'],
      );
    if (key.format === 'jwk')
      return await subtle().importKey('jwk', importableJwk(key.jwk ?? {}), params, false, [usage]);

    return await subtle().importKey(
      key.format,
      arrayBuffer(key.der ?? new Uint8Array()),
      params,
      false,
      [usage],
    );
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    const reason = error instanceof Error ? error.message : String(error);

    if (
      spec.family === 'eddsa' &&
      /not ?supported|unrecognized|unknown/i.test(`${reason} ${(error as Error)?.name ?? ''}`)
    ) {
      throw keyError(
        'This runtime does not support Ed25519 in Web Crypto. Use a current browser or VS Code.',
      );
    }

    throw keyError(
      `The key could not be imported for ${algorithm}: ${reason || 'invalid key data'}.`,
    );
  }
}

async function privateJwk(
  key: JwtKey,
  params: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams,
): Promise<JsonWebKey> {
  if (key.format === 'jwk') return importableJwk(key.jwk ?? {});

  const extractable = await subtle().importKey(
    'pkcs8',
    arrayBuffer(key.der ?? new Uint8Array()),
    params,
    true,
    ['sign'],
  );

  return subtle().exportKey('jwk', extractable);
}

function assertCompatible(key: JwtKey, algorithm: JwtAlgorithm, spec: AlgorithmSpec): void {
  const jwkAlgorithm = key.jwk?.alg;

  if (
    jwkAlgorithm &&
    jwkAlgorithm !== algorithm &&
    !(spec.family === 'eddsa' && (jwkAlgorithm === 'EdDSA' || jwkAlgorithm === 'Ed25519'))
  ) {
    throw keyError(`This JWK is marked for ${jwkAlgorithm}, not ${algorithm}.`);
  }

  if (spec.family === 'hmac') {
    if (key.type !== 'oct') {
      throw keyError(
        `${algorithm} needs a shared secret, but this is ${article(describeType(key))}. Using a public key as an HMAC secret is the algorithm-confusion attack, so it is refused.`,
      );
    }

    return;
  }

  if (key.type === 'oct')
    throw keyError(
      `${algorithm} needs ${spec.family === 'ecdsa' || spec.family === 'eddsa' ? `${article(spec.curve ?? '')} key` : 'an RSA key'} (PEM, certificate or JWK), not a shared secret.`,
    );

  if (spec.family === 'rsa' || spec.family === 'rsa-pss') {
    if (key.type !== 'RSA')
      throw keyError(`${algorithm} needs an RSA key, but this is ${article(describeType(key))}.`);
    if (key.pss && spec.family === 'rsa')
      throw keyError(`This RSA-PSS key can only be used with PS256, PS384 or PS512.`);

    return;
  }

  if (spec.family === 'eddsa') {
    if (key.curve === 'Ed448')
      throw keyError(
        'Ed448 keys are not available in Web Crypto; only Ed25519 EdDSA is supported.',
      );
    if (key.curve !== 'Ed25519')
      throw keyError(
        `${algorithm} needs an Ed25519 key, but this is ${article(describeType(key))}.`,
      );

    return;
  }

  if (key.curve === 'secp256k1') throw unsupportedCurve(key.curve);
  if (key.type !== 'EC' || key.curve !== spec.curve)
    throw keyError(
      `${algorithm} needs ${article(spec.curve ?? '')} key, but this is ${article(describeType(key))}.`,
    );
}

function importParams(
  spec: AlgorithmSpec,
): AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams {
  if (spec.family === 'hmac') return { hash: spec.hash ?? 'SHA-256', name: 'HMAC' };
  if (spec.family === 'rsa') return { hash: spec.hash ?? 'SHA-256', name: 'RSASSA-PKCS1-v1_5' };
  if (spec.family === 'rsa-pss') return { hash: spec.hash ?? 'SHA-256', name: 'RSA-PSS' };
  if (spec.family === 'ecdsa') return { name: 'ECDSA', namedCurve: spec.curve ?? 'P-256' };

  return { name: 'Ed25519' };
}

function signatureParams(
  algorithm: JwtAlgorithm,
): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
  const spec = specs[algorithm];

  if (spec.family === 'hmac') return { name: 'HMAC' };
  if (spec.family === 'rsa') return { name: 'RSASSA-PKCS1-v1_5' };
  if (spec.family === 'rsa-pss') return { name: 'RSA-PSS', saltLength: spec.bytes };
  if (spec.family === 'ecdsa') return { hash: spec.hash ?? 'SHA-256', name: 'ECDSA' };

  return { name: 'Ed25519' };
}
