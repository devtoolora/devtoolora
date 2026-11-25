import { arrayBuffer, keyError, subtle } from './jwtKeyEncoding';
import { importableJwk, jwkKey } from './jwtKeyParse';
import { parseJwtKey } from './jwtKeys';
import { cleanJwk } from './keyPairs';
import { pemEncode } from './pemWrite';

export type KeyConversionDirection = 'jwk-to-pem' | 'pem-to-jwk';

type KeyShape = { bits?: number; curve?: string; isPrivate: boolean; pss?: boolean; type: string };

const MAX_SET_KEYS = 100;
const MAX_INPUT = 1_048_576;
const ecCurves = ['P-256', 'P-384', 'P-521'];

export function detectKeyConversionDirection(source: string): KeyConversionDirection {
  const input = source.trim();

  if (input.startsWith('{')) return 'jwk-to-pem';
  if (input.startsWith('-----BEGIN')) return 'pem-to-jwk';

  throw keyError('Paste a JWK, a JWK Set or a PEM key.');
}

export async function convertJwkToPem(
  source: string,
): Promise<{ keys: Array<{ description: string; kid?: string; pem: string }>; text: string }> {
  if (source.length > MAX_INPUT) throw keyError('Key input must be no larger than 1 MiB.');

  let parsed: unknown;

  try {
    parsed = JSON.parse(source.trim());
  } catch {
    throw keyError('The JWK is not valid JSON.');
  }

  const entries = isSet(parsed) ? parsed.keys : [parsed];

  if (entries.length === 0) throw keyError('The JWK Set has no keys.');
  if (entries.length > MAX_SET_KEYS) throw keyError(`JWK Set exceeds ${MAX_SET_KEYS} keys.`);

  const keys: Array<{ description: string; kid?: string; pem: string }> = [];

  for (const entry of entries) keys.push(await jwkEntryToPem(entry));

  return { keys, text: keys.map((key) => key.pem).join('\n') };
}

export async function convertPemToJwk(
  source: string,
): Promise<{ description: string; jwk: JsonWebKey }> {
  const key = parseJwtKey(source);

  if (!key.der || (key.format !== 'spki' && key.format !== 'pkcs8'))
    throw keyError('Paste a PEM key.');
  if (key.pss)
    throw keyError(
      'RSA-PSS PEM keys cannot be converted: Web Crypto imports RSA PEM keys only as rsaEncryption.',
    );

  const cryptoKey = await importCryptoKey(
    key.format,
    arrayBuffer(key.der),
    key,
    true,
    key.format === 'pkcs8' ? ['sign'] : ['verify'],
  );

  return {
    description: describeKey(key),
    jwk: cleanJwk(await subtle().exportKey('jwk', cryptoKey)),
  };
}

function isSet(value: unknown): value is { keys: unknown[] } {
  return (
    Boolean(value) && typeof value === 'object' && Array.isArray((value as { keys?: unknown }).keys)
  );
}

async function jwkEntryToPem(
  entry: unknown,
): Promise<{ description: string; kid?: string; pem: string }> {
  if (entry && typeof entry === 'object' && Object.hasOwn(entry, 'keys'))
    throw keyError('A JWK Set entry must be a single key, not a nested set.');

  const key = jwkKey(entry, undefined);
  const jwk = key.jwk;

  if (key.type === 'oct' || !jwk) throw keyError('An oct JWK has no PEM form.');

  const shape: KeyShape = {
    ...key,
    pss: typeof jwk.alg === 'string' && jwk.alg.startsWith('PS'),
  };
  const cryptoKey = await importCryptoKey(
    'jwk',
    importableJwk(jwk),
    shape,
    true,
    key.isPrivate ? ['sign'] : ['verify'],
  );
  const format = key.isPrivate ? 'pkcs8' : 'spki';
  const der = new Uint8Array(await subtle().exportKey(format, cryptoKey));

  return {
    description: describeKey(key),
    ...(typeof jwk.kid === 'string' && jwk.kid ? { kid: jwk.kid } : {}),
    pem: pemEncode(key.isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY', der),
  };
}

async function importCryptoKey(
  format: 'jwk' | 'pkcs8' | 'spki',
  keyData: ArrayBuffer | JsonWebKey,
  shape: KeyShape,
  extractable: boolean,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const algorithm = importAlgorithm(shape);

  try {
    return format === 'jwk'
      ? await subtle().importKey('jwk', keyData as JsonWebKey, algorithm, extractable, usages)
      : await subtle().importKey(format, keyData as ArrayBuffer, algorithm, extractable, usages);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw keyError(`The key could not be imported: ${reason || 'invalid key data'}.`);
  }
}

function importAlgorithm(
  shape: KeyShape,
): EcKeyImportParams | RsaHashedImportParams | { name: 'Ed25519' } {
  if (shape.type === 'RSA')
    return { hash: 'SHA-256', name: shape.pss ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5' };
  if (shape.type === 'EC' && shape.curve && ecCurves.includes(shape.curve))
    return { name: 'ECDSA', namedCurve: shape.curve };
  if (shape.type === 'OKP' && shape.curve === 'Ed25519') return { name: 'Ed25519' };

  throw keyError(
    `Unsupported curve ${String(shape.curve ?? 'unknown').slice(0, 32)}; use P-256, P-384, P-521 or Ed25519.`,
  );
}

function describeKey(shape: KeyShape): string {
  const visibility = shape.isPrivate ? 'private' : 'public';

  if (shape.type === 'RSA')
    return `RSA ${shape.bits ?? ''}-bit ${visibility} key`.replace('  ', ' ');

  return `${shape.type === 'EC' ? 'EC ' : ''}${shape.curve ?? shape.type} ${visibility} key`;
}
