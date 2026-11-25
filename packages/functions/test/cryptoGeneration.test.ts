import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { describe, it } from 'vitest';
import { encodeBytes, generateTokens, hashBytes, hmacText, randomBytes } from '../src/crypto';

describe('crypto generation boundaries', () => {
  it('hashes exact text and raw binary bytes against independent implementations', async () => {
    const binary = new Uint8Array([0, 255, 128, 13, 10]);

    for (const algorithm of ['sha256', 'sha512', 'sha1', 'md5']) {
      assert.equal(
        await hashBytes(binary, algorithm),
        createHash(algorithm).update(binary).digest('hex'),
      );

      for (const text of ['', 'hello\n', 'Příliš žluťoučký kůň 🐎'])
        assert.equal(
          await hashBytes(new TextEncoder().encode(text), algorithm),
          createHash(algorithm).update(text, 'utf8').digest('hex'),
        );
    }

    assert.equal(
      await hmacText('', ' secret ', 'sha256'),
      createHmac('sha256', ' secret ').update('').digest('hex'),
    );

    await assert.rejects(() => hashBytes(new TextEncoder().encode('hello'), ''));
  });

  it('rejects invalid random-byte boundaries and generates exact encoded sizes', () => {
    for (const count of [-1, 1.5, 65537, Infinity]) assert.throws(() => randomBytes(count));
    assert.equal(randomBytes(0).length, 0);

    assert.equal(
      generateTokens({ byteCount: 32, count: 1, encoding: 'base64url', mode: 'bytes' })[0]!.length,
      43,
    );

    assert.equal(encodeBytes(new Uint8Array([255]), 'base64'), '/w==');
  });

  it('rejects uneven-tail bytes before choosing custom alphabet characters', () => {
    const crypto = globalThis.crypto;
    const original = crypto.getRandomValues;
    let calls = 0;

    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: (bytes: Uint8Array): Uint8Array => {
        calls += 1;
        bytes.fill(calls === 1 ? 255 : 0);

        return bytes;
      },
    });

    try {
      assert.deepEqual(
        generateTokens({
          count: 1,
          length: 16,
          lowercase: true,
          mode: 'custom',
          numbers: false,
          uppercase: false,
        }),
        ['a'.repeat(16)],
      );

      assert.equal(calls, 2);
    } finally {
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: original });
    }
  });
});
