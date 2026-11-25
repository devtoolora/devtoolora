import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  inspectPemKey,
  createUlid,
  generateTokens,
  hashBytes,
  hmacText,
  randomUuid,
  scorePassword,
} from '@devtoolora/functions/crypto';
import { FunctionError } from '@devtoolora/functions/errors';

describe('crypto functions', () => {
  it('generates standard digests and HMAC values', async () => {
    assert.equal(
      await hashBytes(new TextEncoder().encode('hello'), 'sha256'),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );

    assert.equal(
      await hashBytes(new TextEncoder().encode('hello'), 'md5'),
      '5d41402abc4b2a76b9719d911017c592',
    );

    assert.equal((await hmacText('hello', 'secret', 'sha256')).length, 64);
  });

  it('generates UUID/ULID values and scores passwords', () => {
    assert.match(
      randomUuid(),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    assert.match(createUlid(), /^[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.equal(scorePassword('correct horse battery staple 42!').rating, 'strong');
  });

  it('generates typed custom and encoded-byte tokens', () => {
    const custom = generateTokens({
      mode: 'custom',
      count: 2,
      length: 24,
      lowercase: true,
      uppercase: false,
      numbers: false,
    });

    assert.equal(custom.length, 2);
    assert.ok(custom.every((value) => /^[a-z]{24}$/.test(value)));
    const encoded = generateTokens({ mode: 'bytes', count: 1, byteCount: 16, encoding: 'hex' });

    assert.match(encoded[0]!, /^[0-9a-f]{32}$/);
  });

  it('rejects unsupported hash algorithms with typed errors', async () => {
    await assert.rejects(
      () => hashBytes(new TextEncoder().encode('hello'), 'sha999'),
      (error: unknown) => error instanceof FunctionError && error.code === 'CRYPTO_ERROR',
    );
  });

  it('inspects PEM public keys through the reusable crypto API', async () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const report = await inspectPemKey(pem);

    assert.equal(report.kind, 'public');
    assert.equal(report.algorithm, 'rsa');
    assert.match(String(report.publicKeyFingerprintSha256), /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });

  it('rejects invalid PEM with a typed error', async () => {
    await assert.rejects(
      () => inspectPemKey('not a PEM key'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_PEM',
    );
  });
});
