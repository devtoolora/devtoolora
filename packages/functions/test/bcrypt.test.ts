import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { hashBcrypt, verifyBcrypt } from '../src/crypto';

const vector = '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW';
const rejects = (action: () => Promise<unknown>, message: string) =>
  assert.rejects(action, (error) => error instanceof Error && error.message === message);

describe('bcrypt', () => {
  it('verifies a known $2a$ vector', async () => {
    assert.deepEqual(await verifyBcrypt('U*U', vector), { match: true, prefix: '$2a$' });
    assert.deepEqual(await verifyBcrypt('U*V', vector), { match: false, prefix: '$2a$' });
  });

  it('hashes to $2b$ and verifies', async () => {
    const { hash, ms } = await hashBcrypt('secret', 4);

    assert.match(hash, /^\$2b\$04\$[./A-Za-z0-9]{53}$/);
    assert.ok(ms >= 0);
    assert.deepEqual(await verifyBcrypt('secret', hash), { match: true, prefix: '$2b$' });
  });

  it('keeps surrounding spaces', async () => {
    const { hash } = await hashBcrypt('a', 4);

    assert.equal((await verifyBcrypt(' a', hash)).match, false);
  });

  it('refuses a verify password over 72 bytes instead of matching on the first 72', async () => {
    const { hash } = await hashBcrypt('x'.repeat(72), 4);

    assert.equal((await verifyBcrypt('x'.repeat(72), hash)).match, true);

    await rejects(
      () => verifyBcrypt('x'.repeat(80), hash),
      'Bcrypt uses only the first 72 bytes; this password is 80 bytes. Shorten it or pre-hash it.',
    );
  });

  it('allows 72 bytes and rejects 73 or more', async () => {
    await hashBcrypt('é'.repeat(36), 4);

    await rejects(
      () => hashBcrypt('é'.repeat(37), 4),
      'Bcrypt uses only the first 72 bytes; this password is 74 bytes. Shorten it or pre-hash it.',
    );
  });

  it('rejects an empty password and out-of-range cost', async () => {
    await rejects(() => hashBcrypt('', 4), 'Password is empty.');
    await rejects(() => hashBcrypt('a', 3), 'Cost must be between 4 and 14.');
    await rejects(() => hashBcrypt('a', 15), 'Cost must be between 4 and 14.');
    await rejects(() => hashBcrypt('a', 4.5), 'Cost must be between 4 and 14.');
  });

  it('rejects bad prefixes, malformed hashes and hostile cost before hashing', async () => {
    const body = vector.slice(7);

    await rejects(
      () => verifyBcrypt('a', `$2x$05$${body}`),
      'Unsupported bcrypt prefix "$2x$"; use $2a$, $2b$ or $2y$.',
    );

    await rejects(
      () => verifyBcrypt('a', `$2$05$${body}`),
      'Unsupported bcrypt prefix "$2$"; use $2a$, $2b$ or $2y$.',
    );

    await rejects(
      () => verifyBcrypt('a', 'nope'),
      'Hash must look like $2b$10$ followed by 53 characters of [./A-Za-z0-9].',
    );

    await rejects(() => verifyBcrypt('a', `$2b$15$${body}`), 'Cost must be between 4 and 14.');
    await rejects(() => verifyBcrypt('a', `$2b$03$${body}`), 'Cost must be between 4 and 14.');
  });
});
