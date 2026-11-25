import { FunctionError } from '../errors';
import { subtle } from './jwtKeyEncoding';
import { pemEncode } from './pemWrite';

export type KeyPairAlgorithm =
  | { kind: 'ecdsa'; namedCurve: 'P-256' | 'P-384' | 'P-521' }
  | { kind: 'ed25519' }
  | { kind: 'rsa'; modulusLength: 2048 | 3072 | 4096 };

type GeneratedKeyPair = {
  description: string;
  privateJwk: JsonWebKey;
  privatePem: string;
  publicJwk: JsonWebKey;
  publicPem: string;
};

export function cleanJwk(jwk: JsonWebKey): JsonWebKey {
  const { alg: _alg, ext: _ext, key_ops: _keyOps, ...rest } = jwk;

  return rest;
}

export async function generateKeyPair(algorithm: KeyPairAlgorithm): Promise<GeneratedKeyPair> {
  const description = describe(algorithm);
  let pair: CryptoKeyPair;

  try {
    pair = (await subtle().generateKey(webCryptoParams(algorithm), true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw new FunctionError('KEY_GENERATION_ERROR', unsupportedMessage(algorithm, description));
  }

  const [pkcs8, spki, privateJwk, publicJwk] = await Promise.all([
    subtle().exportKey('pkcs8', pair.privateKey),
    subtle().exportKey('spki', pair.publicKey),
    subtle().exportKey('jwk', pair.privateKey),
    subtle().exportKey('jwk', pair.publicKey),
  ]);

  return {
    description,
    privateJwk: cleanJwk(privateJwk),
    privatePem: pemEncode('PRIVATE KEY', new Uint8Array(pkcs8)),
    publicJwk: cleanJwk(publicJwk),
    publicPem: pemEncode('PUBLIC KEY', new Uint8Array(spki)),
  };
}

function describe(algorithm: KeyPairAlgorithm): string {
  if (algorithm.kind === 'rsa') return `RSA ${algorithm.modulusLength}-bit`;

  return algorithm.kind === 'ecdsa' ? `ECDSA ${algorithm.namedCurve}` : 'Ed25519';
}

function unsupportedMessage(algorithm: KeyPairAlgorithm, description: string): string {
  if (algorithm.kind === 'ed25519')
    return 'This browser cannot generate Ed25519 keys; use RSA or ECDSA.';

  return `This browser cannot generate ${algorithm.kind === 'rsa' ? 'RSA' : description} keys.`;
}

function webCryptoParams(
  algorithm: KeyPairAlgorithm,
): Algorithm | EcKeyGenParams | RsaHashedKeyGenParams {
  if (algorithm.kind === 'rsa')
    return {
      hash: 'SHA-256',
      modulusLength: algorithm.modulusLength,
      name: 'RSASSA-PKCS1-v1_5',
      publicExponent: new Uint8Array([1, 0, 1]),
    };

  return algorithm.kind === 'ecdsa'
    ? { name: 'ECDSA', namedCurve: algorithm.namedCurve }
    : { name: 'Ed25519' };
}
