import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { describe, it } from 'vitest';
import { generateKeyPair, pemEncode } from '../src/crypto';

describe('key pairs', () => {
  it('writes PEM wrapped at 64 columns', () => {
    const pem = pemEncode('PUBLIC KEY', new Uint8Array(70));
    const lines = pem.split('\n');

    assert.equal(lines[0], '-----BEGIN PUBLIC KEY-----');
    assert.equal(lines[1]!.length, 64);
    assert.equal(lines.at(-2), '-----END PUBLIC KEY-----');
    assert.equal(lines.at(-1), '');
  });

  it('generates RSA, ECDSA and Ed25519 pairs that Node parses', async () => {
    const rsa = await generateKeyPair({ kind: 'rsa', modulusLength: 2048 });
    const ec = await generateKeyPair({ kind: 'ecdsa', namedCurve: 'P-256' });
    const ed = await generateKeyPair({ kind: 'ed25519' });

    assert.equal(createPrivateKey(rsa.privatePem).asymmetricKeyDetails?.modulusLength, 2048);
    assert.equal(createPublicKey(rsa.publicPem).asymmetricKeyType, 'rsa');
    assert.equal(createPrivateKey(ec.privatePem).asymmetricKeyDetails?.namedCurve, 'prime256v1');
    assert.equal(createPublicKey(ed.publicPem).asymmetricKeyType, 'ed25519');
    assert.ok(rsa.privatePem.startsWith('-----BEGIN PRIVATE KEY-----\n'));
    assert.ok(rsa.publicPem.startsWith('-----BEGIN PUBLIC KEY-----\n'));

    assert.deepEqual(
      [rsa.description, ec.description, ed.description],
      ['RSA 2048-bit', 'ECDSA P-256', 'Ed25519'],
    );
  });

  it('exports JWKs without alg, ext or key_ops', async () => {
    const { privateJwk, publicJwk } = await generateKeyPair({ kind: 'ed25519' });

    assert.deepEqual(Object.keys(publicJwk).sort(), ['crv', 'kty', 'x']);
    assert.deepEqual(Object.keys(privateJwk).sort(), ['crv', 'd', 'kty', 'x']);
    assert.equal(publicJwk.crv, 'Ed25519');
    assert.ok(!('d' in publicJwk));
    const rsa = await generateKeyPair({ kind: 'rsa', modulusLength: 2048 });

    assert.equal(rsa.publicJwk.e, 'AQAB');
    assert.ok(!('alg' in rsa.privateJwk) && !('key_ops' in rsa.privateJwk));
  });

  it('maps NotSupportedError to one sentence', async () => {
    const subtle = globalThis.crypto.subtle;
    const reject = () => Promise.reject(new DOMException('no', 'NotSupportedError'));

    Object.defineProperty(subtle, 'generateKey', { configurable: true, value: reject });

    try {
      await assert.rejects(
        generateKeyPair({ kind: 'ed25519' }),
        /This browser cannot generate Ed25519 keys; use RSA or ECDSA\./,
      );
    } finally {
      Reflect.deleteProperty(subtle, 'generateKey');
    }
  });
});
