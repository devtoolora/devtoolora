import { base64Decode, base64Encode, utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { randomBytes } from './primitives';

const VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = 1 + 4 + SALT_LENGTH + IV_LENGTH;
const DEFAULT_ITERATIONS = 600_000;
const MIN_ITERATIONS = 1000;
const MAX_ITERATIONS = 10_000_000;
const MAX_PASSPHRASE = 1024;
const MAX_ENVELOPE = 16_777_216;

/** Encrypts with AES-256-GCM into Base64: version, iterations, salt, IV, ciphertext and tag. */
export async function encryptAesGcm(
  plaintext: Uint8Array,
  passphrase: string,
  options: { iterations?: number } = {},
): Promise<string> {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;

  checkPassphrase(passphrase);

  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS)
    throw aesError('Iterations must be an integer between 1,000 and 10,000,000.');

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveAesKey(passphrase, salt, iterations);
  const sealed = new Uint8Array(
    await subtle().encrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(iv) },
      key,
      Uint8Array.from(plaintext),
    ),
  );
  const envelope = new Uint8Array(HEADER_LENGTH + sealed.length);

  envelope[0] = VERSION;
  new DataView(envelope.buffer).setUint32(1, iterations);
  envelope.set(salt, 5);
  envelope.set(iv, 5 + SALT_LENGTH);
  envelope.set(sealed, HEADER_LENGTH);

  return base64Encode(envelope);
}

export async function decryptAesGcm(
  envelope: string,
  passphrase: string,
): Promise<{ bytes: Uint8Array; iterations: number }> {
  checkPassphrase(passphrase);

  const raw = parseEnvelope(envelope);
  const iterations = new DataView(raw.buffer, raw.byteOffset).getUint32(1);

  if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS)
    throw aesError('Envelope holds an unsupported PBKDF2 iteration count.');

  try {
    const key = await deriveAesKey(passphrase, raw.slice(5, 5 + SALT_LENGTH), iterations);
    const iv = raw.slice(5 + SALT_LENGTH, HEADER_LENGTH);

    return {
      bytes: new Uint8Array(
        await subtle().decrypt({ name: 'AES-GCM', iv }, key, raw.slice(HEADER_LENGTH)),
      ),
      iterations,
    };
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw aesError('Decryption failed: wrong passphrase or corrupted data.');
  }
}

function parseEnvelope(envelope: string): Uint8Array {
  if (!envelope.trim()) throw aesError('Envelope is required.');
  if (envelope.length > MAX_ENVELOPE) throw aesError('Envelope exceeds 16,777,216 characters.');

  const compact = envelope.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) throw aesError('Envelope is not valid Base64.');

  const unpadded = compact.replace(/(?<!=)=+$/, '');

  if (unpadded.length % 4 === 1) throw aesError('Envelope is not valid Base64.');

  const raw = base64Decode(unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '='));

  if (raw.length < HEADER_LENGTH + TAG_LENGTH)
    throw aesError('Envelope is too short to hold a version, salt, IV and ciphertext.');
  if (raw[0] !== VERSION)
    throw aesError('Unsupported envelope version; this tool reads version 1.');

  return raw;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    Uint8Array.from(utf8Bytes(passphrase.normalize('NFKC'))),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function checkPassphrase(passphrase: string): void {
  if (!passphrase) throw aesError('Passphrase is required.');
  if (passphrase.length > MAX_PASSPHRASE) throw aesError('Passphrase exceeds 1,024 characters.');
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;

  if (!api) throw aesError('Web Crypto is unavailable in this runtime.');

  return api;
}

function aesError(message: string): FunctionError {
  return new FunctionError('AES_ERROR', message);
}
