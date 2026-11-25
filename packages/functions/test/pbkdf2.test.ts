import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { describe, it } from 'vitest';
import { derivePbkdf2, type Pbkdf2Hash } from '../src/crypto';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const utf8 = (text: string) => new TextEncoder().encode(text);

describe('PBKDF2', () => {
  it('matches the RFC 6070 and SHA-256 vectors and node:crypto', async () => {
    const cases: Array<[string, string, number, number, 'SHA-1' | 'SHA-256', string]> = [
      ['password', 'salt', 1, 20, 'SHA-1', '0c60c80f961f0e71f3a9b524af6012062fe037a6'],
      ['password', 'salt', 4096, 20, 'SHA-1', '4b007901b765489abead49d926f721d065a429c1'],
      [
        'passwordPASSWORDpassword',
        'saltSALTsaltSALTsaltSALTsaltSALTsalt',
        4096,
        25,
        'SHA-1',
        '3d2eec4fe41c849b80c8d83662c0e44a8b291a964cf2f07038',
      ],
      [
        'password',
        'salt',
        1,
        32,
        'SHA-256',
        '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
      ],
      [
        'password',
        'salt',
        4096,
        32,
        'SHA-256',
        'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a',
      ],
    ];

    for (const [password, salt, iterations, keyLength, hash, expected] of cases) {
      const { key } = await derivePbkdf2({
        hash,
        iterations,
        keyLength,
        password,
        salt: utf8(salt),
      });

      assert.equal(hex(key), expected);

      assert.equal(
        hex(key),
        pbkdf2Sync(
          password,
          salt,
          iterations,
          keyLength,
          hash.replace('-', '').toLowerCase(),
        ).toString('hex'),
      );
    }
  });

  it('reports weak settings as findings', async () => {
    const weak = await derivePbkdf2({
      hash: 'SHA-256',
      iterations: 1000,
      keyLength: 32,
      password: 'p',
      salt: new Uint8Array(),
    });

    assert.deepEqual(
      weak.findings.map((f) => `${f.level}:${f.message}`),
      [
        'medium:1,000 iterations is below the OWASP floor of 600,000 for SHA-256.',
        'medium:The salt is empty; use at least 16 random bytes.',
      ],
    );

    assert.deepEqual(
      (
        await derivePbkdf2({
          hash: 'SHA-512',
          iterations: 220_000,
          keyLength: 64,
          password: 'p',
          salt: utf8('0123456789abcdef'),
        })
      ).findings,
      [],
    );
  });

  it('uses the OWASP floors and names the nearest one for SHA-384', async () => {
    const messages = async (hash: Pbkdf2Hash, iterations: number): Promise<string[]> =>
      (
        await derivePbkdf2({
          hash,
          iterations,
          keyLength: 1,
          password: 'p',
          salt: utf8('0123456789abcdef'),
        })
      ).findings.map((finding) => finding.message);

    assert.deepEqual(await messages('SHA-512', 215_000), [
      '215,000 iterations is below the OWASP floor of 220,000 for SHA-512.',
    ]);

    assert.deepEqual(await messages('SHA-1', 1_300_000), [
      '1,300,000 iterations is below the OWASP floor of 1,400,000 for SHA-1.',
    ]);

    assert.deepEqual(await messages('SHA-384', 215_000), [
      '215,000 iterations is below the OWASP floor of 220,000 for SHA-512, the nearest hash OWASP lists.',
    ]);
  });

  it('enforces its limits', async () => {
    const base = {
      hash: 'SHA-256' as const,
      iterations: 1,
      keyLength: 32,
      password: 'p',
      salt: utf8('s'),
    };

    await assert.rejects(derivePbkdf2({ ...base, password: '' }), /Password is required\./);

    await assert.rejects(
      derivePbkdf2({ ...base, password: 'p'.repeat(1025) }),
      /Password exceeds 1,024 characters\./,
    );

    await assert.rejects(
      derivePbkdf2({ ...base, iterations: 0 }),
      /Iterations must be an integer between 1 and 10,000,000\./,
    );

    await assert.rejects(
      derivePbkdf2({ ...base, keyLength: 513 }),
      /Key length must be an integer between 1 and 512 bytes\./,
    );
  });
});
