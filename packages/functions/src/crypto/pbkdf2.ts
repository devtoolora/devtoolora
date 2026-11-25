import { utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { sortFindings, type Finding } from '../web/findings';

export type Pbkdf2Hash = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

type Pbkdf2Options = {
  hash: Pbkdf2Hash;
  iterations: number;
  keyLength: number;
  password: string;
  salt: Uint8Array;
};

const MAX_PASSWORD = 1024;
const MAX_ITERATIONS = 10_000_000;
const MAX_KEY_LENGTH = 512;
const floors: Record<Pbkdf2Hash, number> = {
  'SHA-1': 1_400_000,
  'SHA-256': 600_000,
  // OWASP lists no SHA-384 floor, so it takes SHA-512's.
  'SHA-384': 220_000,
  'SHA-512': 220_000,
};

export async function derivePbkdf2(
  options: Pbkdf2Options,
): Promise<{ findings: Finding[]; key: Uint8Array }> {
  const { hash, iterations, keyLength, password, salt } = options;

  if (!password) throw pbkdf2Error('Password is required.');
  if (password.length > MAX_PASSWORD) throw pbkdf2Error('Password exceeds 1,024 characters.');
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS)
    throw pbkdf2Error('Iterations must be an integer between 1 and 10,000,000.');
  if (!Number.isInteger(keyLength) || keyLength < 1 || keyLength > MAX_KEY_LENGTH)
    throw pbkdf2Error('Key length must be an integer between 1 and 512 bytes.');
  if (!(hash in floors)) throw pbkdf2Error('Choose SHA-1, SHA-256, SHA-384 or SHA-512.');

  const subtle = globalThis.crypto?.subtle;

  if (!subtle) throw pbkdf2Error('Web Crypto is unavailable in this runtime.');

  const material = await subtle.importKey(
    'raw',
    Uint8Array.from(utf8Bytes(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash, salt: Uint8Array.from(salt), iterations },
    material,
    keyLength * 8,
  );

  return { findings: sortFindings(weaknesses(options)), key: new Uint8Array(bits) };
}

function weaknesses({ hash, iterations, salt }: Pbkdf2Options): Finding[] {
  const findings: Finding[] = [];

  if (iterations < floors[hash])
    findings.push({
      level: 'medium',
      message: `${iterations.toLocaleString('en-US')} iterations is below the OWASP floor of ${floors[hash].toLocaleString('en-US')} for ${hash === 'SHA-384' ? 'SHA-512, the nearest hash OWASP lists' : hash}.`,
    });
  if (salt.length === 0)
    findings.push({ level: 'medium', message: 'The salt is empty; use at least 16 random bytes.' });

  return findings;
}

function pbkdf2Error(message: string): FunctionError {
  return new FunctionError('PBKDF2_ERROR', message);
}
