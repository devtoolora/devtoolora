import { FunctionError } from '../errors';

export type Argon2Variant = 'argon2id' | 'argon2i' | 'argon2d';

export type Argon2Params = {
  hashLength: number;
  iterations: number;
  memory: number;
  parallelism: number;
  variant: Argon2Variant;
};

const limits = {
  hashLength: { max: 64, min: 16 },
  iterations: { max: 10, min: 1 },
  memory: { max: 65536, min: 1024 },
  parallelism: { max: 4, min: 1 },
  salt: { max: 64, min: 8 },
};
const maxPasswordBytes = 1024;
const phcPattern =
  /^\$(argon2id|argon2i|argon2d)(?:\$v=(\d+))?\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

export async function hashArgon2(
  password: string,
  params: Argon2Params,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<{ hash: string; ms: number }> {
  const bytes = checkPassword(password);

  checkParams(params);
  checkSalt(salt.length);

  const argon2 = await loadArgon2();
  const start = performance.now();
  const digest = await derive(argon2, bytes, salt, params);
  const { iterations, memory, parallelism, variant } = params;
  const hash = `$${variant}$v=19$m=${memory},t=${iterations},p=${parallelism}$${toBase64(salt)}$${toBase64(digest)}`;

  return { hash, ms: Math.round(performance.now() - start) };
}

export async function verifyArgon2(
  password: string,
  phc: string,
): Promise<{ match: boolean; ms: number; params: Argon2Params }> {
  const parsed = parsePhc(phc.trim());
  const bytes = checkPassword(password);
  const argon2 = await loadArgon2();
  const start = performance.now();
  const digest = await derive(argon2, bytes, parsed.salt, parsed.params);

  return {
    match: constantTimeEqual(digest, parsed.digest),
    ms: Math.round(performance.now() - start),
    params: parsed.params,
  };
}

export function parseArgon2Salt(text: string): Uint8Array {
  const value = text.trim();
  const bytes = /^(?:[0-9a-fA-F]{2})+$/.test(value)
    ? Uint8Array.from(value.match(/../g) ?? [], (pair) => parseInt(pair, 16))
    : fromBase64(value.replace(/(?<!=)=+$/, ''));

  if (!bytes) throw argon2Error('Salt must be hex or Base64.');

  checkSalt(bytes.length);

  return bytes;
}

function parsePhc(phc: string) {
  const parts = phcPattern.exec(phc);

  if (!parts)
    throw argon2Error('Hash must look like $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>.');

  // A missing v= means the original 1.0 (version 16) format.
  const version = parts[2] ?? '16';

  if (version === '16') throw argon2Error('Argon2 version 16 (1.0) is not supported.');
  if (version !== '19')
    throw argon2Error(`Argon2 version ${version} is not supported; only 19 is.`);

  // 64 bytes is 86 Base64 characters without padding.
  if ((parts[6] ?? '').length > 86 || (parts[7] ?? '').length > 86)
    throw argon2Error('Salt or hash is longer than 64 bytes.');

  const salt = fromBase64(parts[6] ?? '');
  const digest = fromBase64(parts[7] ?? '');

  if (!salt || !digest) throw argon2Error('Salt or hash is not valid Base64.');

  const params: Argon2Params = {
    hashLength: digest.length,
    iterations: Number(parts[4]),
    memory: Number(parts[3]),
    parallelism: Number(parts[5]),
    variant: parts[1] as Argon2Variant,
  };

  checkParams(params);
  checkSalt(salt.length);

  return { digest, params, salt };
}

function checkPassword(password: string): Uint8Array {
  if (password === '') throw argon2Error('Password is empty.');

  const bytes = new TextEncoder().encode(password);

  if (bytes.length > maxPasswordBytes)
    throw argon2Error(
      `Password must be at most ${maxPasswordBytes} bytes; this one is ${bytes.length}.`,
    );

  return bytes;
}

function checkParams(params: Argon2Params): void {
  const entries = [
    ['Memory', params.memory, limits.memory, ' KiB'],
    ['Iterations', params.iterations, limits.iterations, ''],
    ['Parallelism', params.parallelism, limits.parallelism, ''],
    ['Hash length', params.hashLength, limits.hashLength, ' bytes'],
  ] as const;

  for (const [label, value, { max, min }, unit] of entries)
    if (!Number.isInteger(value) || value < min || value > max)
      throw argon2Error(
        `${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}${unit}.`,
      );
}

function checkSalt(length: number): void {
  if (length < limits.salt.min || length > limits.salt.max)
    throw argon2Error(`Salt must be 8-64 bytes; this one is ${length}.`);
}

async function derive(
  argon2: Awaited<ReturnType<typeof loadArgon2>>,
  password: Uint8Array,
  salt: Uint8Array,
  params: Argon2Params,
) {
  const derive = {
    argon2d: argon2.argon2dAsync,
    argon2i: argon2.argon2iAsync,
    argon2id: argon2.argon2idAsync,
  }[params.variant];

  return derive(password, salt, {
    dkLen: params.hashLength,
    m: params.memory,
    p: params.parallelism,
    t: params.iterations,
  });
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;

  for (let index = 0; index < Math.max(a.length, b.length); index += 1)
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);

  return diff === 0;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/(?<!=)=+$/, '');
}

function fromBase64(text: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9+/_-]+$/.test(text) || text.length % 4 === 1) return undefined;

  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// Dynamic so @noble/hashes stays out of the chunks other domains share with crypto.
async function loadArgon2() {
  return import('@noble/hashes/argon2.js');
}

function argon2Error(message: string): FunctionError {
  return new FunctionError('ARGON2_ERROR', message);
}
