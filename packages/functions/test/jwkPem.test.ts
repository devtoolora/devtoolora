import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'vitest';
import { convertJwkToPem, convertPemToJwk, detectKeyConversionDirection } from '../src/crypto';

const demoLeafPem = `-----BEGIN CERTIFICATE-----
MIIDqjCCApKgAwIBAgIUbnNxtt+TJrVPfC5PHYXh2PpfIlQwDQYJKoZIhvcNAQEL
BQAwQzEeMBwGA1UEAwwVRGV2IFRvb2xvcmEgRGVtbyBSb290MRQwEgYDVQQKDAtE
ZXYgVG9vbG9yYTELMAkGA1UEBhMCVVMwHhcNMjYxMTA4MTI1NDM2WhcNMzYxMTA1
MTI1NDM2WjA8MRcwFQYDVQQDDA5hcGkubG9jYWwudGVzdDEUMBIGA1UECgwLRGV2
IFRvb2xvcmExCzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAsiVUmQM3aFrB47xmje5jIoFLkFPO8VVk+hzYtZb4DAGpVWFED5of4Scj
UMJlw5trq+G7QV0oc0Z3VWVIY2jwp5uJwECsktcstImW/CRb1ZLsWScGXr6XrlaX
I4m76sS1kbQzRvBJYCQ4MOJBUFpukr/PUmXrRKVvbpmqShx+JHNHmTLF3vXBD9zI
Fyr/n6Gi6r7r0FPkqZv3mOtP0vSl3plYhBNafx9GCxj9GkXKGYlImi3ESk67am34
6AcuBjQn16LmI2wkaDeX93o4hNgoxBa2LRXsZWGolL73d6/FCyMrNe25SZ/ueZIV
Ca7uN2mf/EVTQwqSCrOjxZQ/2LAaZQIDAQABo4GcMIGZMAwGA1UdEwEB/wQCMAAw
DgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMBMCQGA1UdEQQdMBuC
DmFwaS5sb2NhbC50ZXN0gglsb2NhbGhvc3QwHQYDVR0OBBYEFOMy0BuXIZnSbpWo
FZLllWs97E3nMB8GA1UdIwQYMBaAFLThud6PBk+f8Sas/korbzNIu3qKMA0GCSqG
SIb3DQEBCwUAA4IBAQCiXo8ooVd+ZoNsEKUDo7G3DkicuHZovU8gBdBaiGuAKBhG
at44kCX0FkK3+5PGtgQtHVBvdBUAE38r6W98AJqzGTj56djwkDXPy7R4diwAzl7v
+4xMaA7BdFPhkJTee/Lh/shytPGcMwNo9yhBAoE6r6xIWSjS3jlnNPrMsxfaLhn6
7xFQOf06Q50x/1Z/v0sZ8xnwk5pO+dB9eDlnz8xsapXUp4uZ+hscXU06vapjaj2a
IsnxL550wsMISTRQZpamu1z8QE9jgLyL83le3tkuxKfE87ajW2uNY7pWe7ENuQNH
78RUNFS60zh2zWBsd5xh189SZVFv5kV6uGQOeRko
-----END CERTIFICATE-----`;

const pairs = {
  ec: () => generateKeyPairSync('ec', { namedCurve: 'P-256' }),
  ed25519: () => generateKeyPairSync('ed25519'),
  rsa: () => generateKeyPairSync('rsa', { modulusLength: 2048 }),
};
const pair = (type: keyof typeof pairs) => pairs[type]();
const pem = (
  key: { export(options: { format: 'pem'; type: 'pkcs8' | 'spki' }): string | Buffer },
  type: 'pkcs8' | 'spki',
) => String(key.export({ format: 'pem', type }));

describe('JWK <-> PEM', () => {
  it('round-trips RSA, EC and Ed25519 keys', async () => {
    for (const type of ['rsa', 'ec', 'ed25519'] as const) {
      const { privateKey, publicKey } = pair(type);
      const privatePem = pem(privateKey, 'pkcs8');
      const publicPem = pem(publicKey, 'spki');
      const privateJwk = await convertPemToJwk(privatePem);
      const publicJwk = await convertPemToJwk(publicPem);

      assert.ok('d' in privateJwk.jwk && !('d' in publicJwk.jwk));

      assert.ok(
        !('alg' in privateJwk.jwk) && !('key_ops' in privateJwk.jwk) && !('ext' in privateJwk.jwk),
      );

      assert.equal(
        (await convertJwkToPem(JSON.stringify(privateJwk.jwk))).keys[0]?.pem,
        privatePem,
      );

      assert.equal((await convertJwkToPem(JSON.stringify(publicJwk.jwk))).keys[0]?.pem, publicPem);
    }

    assert.equal(
      (await convertPemToJwk(pem(pair('rsa').privateKey, 'pkcs8'))).description,
      'RSA 2048-bit private key',
    );

    assert.equal(
      (await convertPemToJwk(pem(pair('ec').publicKey, 'spki'))).description,
      'EC P-256 public key',
    );

    assert.equal(
      (await convertPemToJwk(pem(pair('ed25519').publicKey, 'spki'))).description,
      'Ed25519 public key',
    );
  });

  it('converts JWK Sets, PSS keys and certificates', async () => {
    const a = (await convertPemToJwk(pem(pair('ec').publicKey, 'spki'))).jwk;
    const b = (await convertPemToJwk(pem(pair('rsa').publicKey, 'spki'))).jwk;
    const set = await convertJwkToPem(
      JSON.stringify({
        keys: [
          { ...a, kid: 'a' },
          { ...b, alg: 'PS256', kid: 'b', use: 'sig' },
        ],
      }),
    );

    assert.deepEqual(
      set.keys.map((key) => key.kid),
      ['a', 'b'],
    );

    assert.equal(set.text, `${set.keys[0]?.pem}\n${set.keys[1]?.pem}`);
    assert.equal((await convertPemToJwk(demoLeafPem)).jwk.kty, 'RSA');
  });

  it('rejects what has no PEM form and detects the direction', async () => {
    await assert.rejects(
      convertJwkToPem('{"kty":"oct","k":"AQID"}'),
      /An oct JWK has no PEM form\./,
    );

    await assert.rejects(
      convertJwkToPem('{"kty":"EC","crv":"secp256k1","x":"","y":""}'),
      /Unsupported curve/,
    );

    await assert.rejects(convertJwkToPem('[]'), /A JWK must be a JSON object\./);

    await assert.rejects(
      convertJwkToPem(
        JSON.stringify({ keys: Array.from({ length: 101 }, () => ({ k: 'AQ', kty: 'oct' })) }),
      ),
      /JWK Set exceeds 100 keys\./,
    );

    await assert.rejects(
      convertPemToJwk(
        '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----',
      ),
      /OpenSSH private keys are not supported/,
    );

    assert.equal(detectKeyConversionDirection('  {"kty":"RSA"}'), 'jwk-to-pem');
    assert.equal(detectKeyConversionDirection('-----BEGIN PUBLIC KEY-----'), 'pem-to-jwk');

    assert.throws(
      () => detectKeyConversionDirection('hello'),
      /Paste a JWK, a JWK Set or a PEM key\./,
    );

    await assert.rejects(
      convertPemToJwk('x'.repeat(1_048_577)),
      /Key input must be no larger than 1 MiB\./,
    );
  });

  it('rejects nested sets and malformed JSON without leaking key material', async () => {
    const nested = JSON.stringify({ keys: [{ keys: [{ k: 'AQ', kty: 'oct' }] }] });
    const message = 'A JWK Set entry must be a single key, not a nested set.';

    await assert.rejects(convertJwkToPem(nested), new RegExp(message.replace(/\./g, '\\.')));

    await assert.rejects(
      convertJwkToPem('{"keys":['.repeat(50_000) + ']}'.repeat(50_000)),
      /A JWK Set entry must be a single key, not a nested set\./,
    );

    await assert.rejects(convertJwkToPem('{"d":nWGxne_9WmC6hEr0kuwsx}'), (error) => {
      assert.match(String(error), /The JWK is not valid JSON\./);
      assert.doesNotMatch(String(error), /nWGxne/);

      return true;
    });

    assert.equal(
      String(
        await convertJwkToPem('' + String.fromCharCode(0xfeff) + '{"keys":[]}').catch(String),
      ).includes('no keys'),
      true,
    );
  });
});
