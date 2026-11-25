import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { hashArgon2, parseArgon2Salt, verifyArgon2 } from '../src/crypto';
import type { Argon2Params } from '../src/crypto';

const salt = new TextEncoder().encode('somesalt');
const spec: Argon2Params = {
  hashLength: 32,
  iterations: 2,
  memory: 65536,
  parallelism: 1,
  variant: 'argon2id',
};
const specPhc =
  '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc';
const fast: Argon2Params = { ...spec, memory: 1024 };
const hex = (base64: string) => Buffer.from(base64, 'base64').toString('hex');
const rejects = (action: () => Promise<unknown> | unknown, message: string) =>
  assert.rejects(
    async () => action(),
    (error) => error instanceof Error && error.message === message,
  );

describe('argon2', () => {
  it('matches the spec vectors', async () => {
    const id = await hashArgon2('password', spec, salt);
    const i = await hashArgon2('password', { ...spec, variant: 'argon2i' }, salt);

    assert.equal(id.hash, specPhc);

    assert.equal(
      hex(id.hash.split('$')[5] ?? ''),
      '09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7',
    );

    assert.equal(
      hex(i.hash.split('$')[5] ?? ''),
      'c1628832147d9720c5bd1cfd61367078729f6dfb6f8fea9ff98158e0d7816ed0',
    );

    assert.ok(i.hash.startsWith('$argon2i$v=19$'));
  });

  it('round trips and detects a mismatch', async () => {
    const { hash } = await hashArgon2('secret', fast);
    const hit = await verifyArgon2('secret', hash);

    assert.equal(hit.match, true);
    assert.deepEqual(hit.params, fast);
    assert.equal((await verifyArgon2('Secret', hash)).match, false);
    assert.equal((await verifyArgon2('password', specPhc)).match, true);
  });

  it('trims a pasted hash', async () => {
    assert.equal((await verifyArgon2('password', `\n ${specPhc} \n`)).match, true);
  });

  it('checks every limit at and beyond the boundary', async () => {
    const ok = (params: Partial<Argon2Params>, password = 'a', s = salt) =>
      hashArgon2(password, { ...fast, ...params }, s);

    await ok({}, 'a'.repeat(1024));

    await rejects(
      () => ok({}, 'a'.repeat(1025)),
      'Password must be at most 1024 bytes; this one is 1025.',
    );

    await rejects(() => ok({}, ''), 'Password is empty.');

    await ok({ memory: 1024 });
    await rejects(() => ok({ memory: 1023 }), 'Memory must be between 1,024 and 65,536 KiB.');
    await ok({ memory: 65536, iterations: 1 });
    await rejects(() => ok({ memory: 65537 }), 'Memory must be between 1,024 and 65,536 KiB.');

    await ok({ iterations: 1 });
    await rejects(() => ok({ iterations: 0 }), 'Iterations must be between 1 and 10.');
    await ok({ iterations: 10 });
    await rejects(() => ok({ iterations: 11 }), 'Iterations must be between 1 and 10.');

    await ok({ parallelism: 1 });
    await rejects(() => ok({ parallelism: 0 }), 'Parallelism must be between 1 and 4.');
    await ok({ parallelism: 4 });
    await rejects(() => ok({ parallelism: 5 }), 'Parallelism must be between 1 and 4.');

    await ok({ hashLength: 16 });
    await rejects(() => ok({ hashLength: 15 }), 'Hash length must be between 16 and 64 bytes.');
    await ok({ hashLength: 64 });
    await rejects(() => ok({ hashLength: 65 }), 'Hash length must be between 16 and 64 bytes.');

    await ok({}, 'a', new Uint8Array(8));
    await rejects(() => ok({}, 'a', new Uint8Array(7)), 'Salt must be 8-64 bytes; this one is 7.');
    await ok({}, 'a', new Uint8Array(64));

    await rejects(
      () => ok({}, 'a', new Uint8Array(65)),
      'Salt must be 8-64 bytes; this one is 65.',
    );
  });

  it('measures the password in UTF-8 bytes', async () => {
    await rejects(
      () => hashArgon2('é'.repeat(513), fast, salt),
      'Password must be at most 1024 bytes; this one is 1026.',
    );
  });

  it('rejects version 16 and a missing version', async () => {
    const message = 'Argon2 version 16 (1.0) is not supported.';

    await rejects(() => verifyArgon2('a', specPhc.replace('v=19', 'v=16')), message);
    await rejects(() => verifyArgon2('a', specPhc.replace('v=19$', '')), message);
  });

  it('names other versions and rejects salts or hashes over 64 bytes', async () => {
    await rejects(
      () => verifyArgon2('a', specPhc.replace('v=19', 'v=20')),
      'Argon2 version 20 is not supported; only 19 is.',
    );

    const parts = specPhc.split('$');
    const long = (index: number, length: number) =>
      parts.map((part, at) => (at === index ? 'A'.repeat(length) : part)).join('$');
    const tooLong = 'Salt or hash is longer than 64 bytes.';

    await rejects(() => verifyArgon2('a', long(4, 87)), tooLong);
    await rejects(() => verifyArgon2('a', long(5, 87)), tooLong);
    // 86 characters is within the check, so the next check (salt length 64 bytes) is what runs.
    await verifyArgon2('a', long(5, 86)).then((result) => assert.equal(result.match, false));
  });

  it('rejects out-of-range hash parameters before any work', async () => {
    await rejects(
      () => verifyArgon2('a', specPhc.replace('m=65536', 'm=4194304')),
      'Memory must be between 1,024 and 65,536 KiB.',
    );

    await rejects(
      () => verifyArgon2('a', 'nope'),
      'Hash must look like $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>.',
    );

    await rejects(
      () => verifyArgon2('a', specPhc.replace('argon2id', 'argon2x')),
      'Hash must look like $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>.',
    );
  });

  it('parses a salt as hex or Base64', () => {
    const expected = [...salt];

    assert.deepEqual([...parseArgon2Salt('736f6d6573616c74')], expected);
    assert.deepEqual([...parseArgon2Salt('c29tZXNhbHQ')], expected);
    assert.deepEqual([...parseArgon2Salt('c29tZXNhbHQ=')], expected);
    assert.deepEqual([...parseArgon2Salt(' c29tZXNhbHQ ')], expected);

    assert.deepEqual(
      [...parseArgon2Salt('_-_-_-_-_-_-')],
      [...Buffer.from('_-_-_-_-_-_-', 'base64url')],
    );

    assert.throws(() => parseArgon2Salt('abcd'), /Salt must be 8-64 bytes; this one is 2\./);
    assert.throws(() => parseArgon2Salt('***'), /Salt must be hex or Base64\./);
  });

  describe('without loading noble', () => {
    const loadFresh = async () => {
      const loaded = vi.fn();

      vi.resetModules();

      vi.doMock('@noble/hashes/argon2.js', () => {
        loaded();

        return {};
      });

      return { loaded, module: await import('../src/crypto/argon2') };
    };

    it('rejects a hostile hash before the library is imported', async () => {
      const { loaded, module } = await loadFresh();

      await rejects(
        () => module.verifyArgon2('a', specPhc.replace('m=65536', 'm=4194304')),
        'Memory must be between 1,024 and 65,536 KiB.',
      );

      assert.equal(loaded.mock.calls.length, 0);
    });

    it('rejects an oversized memory before the library is imported', async () => {
      const { loaded, module } = await loadFresh();

      await rejects(
        () => module.hashArgon2('a', { ...fast, memory: 65537 }, salt),
        'Memory must be between 1,024 and 65,536 KiB.',
      );

      assert.equal(loaded.mock.calls.length, 0);
    });
  });
});
