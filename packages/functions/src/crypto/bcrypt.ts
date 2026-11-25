import { FunctionError } from '../errors';

export type BcryptPrefix = '$2a$' | '$2b$' | '$2y$';

const minCost = 4;
const maxCost = 14;

export async function hashBcrypt(
  password: string,
  cost: number,
): Promise<{ hash: string; ms: number }> {
  if (!Number.isInteger(cost) || cost < minCost || cost > maxCost) throw costError();
  if (password === '') throw bcryptError('Password is empty.');

  rejectLongPassword(password);

  const bcrypt = await loadBcrypt();
  const start = performance.now();
  const hash = await bcrypt.hash(password, await bcrypt.genSalt(cost));

  return { hash, ms: Math.round(performance.now() - start) };
}

export async function verifyBcrypt(
  password: string,
  hash: string,
): Promise<{ match: boolean; prefix: BcryptPrefix }> {
  const prefix = /^(\$2[a-z]?\$)/.exec(hash)?.[1];

  if (prefix && !['$2a$', '$2b$', '$2y$'].includes(prefix))
    throw bcryptError(`Unsupported bcrypt prefix "${prefix}"; use $2a$, $2b$ or $2y$.`);

  const parts = /^(\$2[aby]\$)(\d\d)\$[./A-Za-z0-9]{53}$/.exec(hash);

  if (!parts)
    throw bcryptError('Hash must look like $2b$10$ followed by 53 characters of [./A-Za-z0-9].');

  const cost = Number(parts[2]);

  if (cost < minCost || cost > maxCost) throw costError();

  rejectLongPassword(password);

  const bcrypt = await loadBcrypt();

  return { match: await bcrypt.compare(password, hash), prefix: parts[1] as BcryptPrefix };
}

function rejectLongPassword(password: string): void {
  const bytes = new TextEncoder().encode(password).length;

  if (bytes > 72)
    throw bcryptError(
      `Bcrypt uses only the first 72 bytes; this password is ${bytes} bytes. Shorten it or pre-hash it.`,
    );
}

// Dynamic so bcryptjs stays out of the chunks other domains share with crypto.
async function loadBcrypt() {
  return (await import('bcryptjs')).default;
}

function bcryptError(message: string): FunctionError {
  return new FunctionError('BCRYPT_ERROR', message);
}

function costError(): FunctionError {
  return bcryptError(`Cost must be between ${minCost} and ${maxCost}.`);
}
