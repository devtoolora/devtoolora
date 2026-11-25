import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  constants,
  createHmac,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import {
  decodeJwt,
  parseJwtDuration,
  signJwt,
  verifyJwt,
  type JwtSecretEncoding,
} from '@devtoolora/functions/crypto';
import { FunctionError } from '@devtoolora/functions/errors';

const now = 1_760_000_000;
const base64Url = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const unsigned = (header: object, payload: object) =>
  `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
const jwtError = (pattern: RegExp) => (error: unknown) =>
  error instanceof FunctionError && pattern.test(error.message);

function nodeToken(
  algorithm: string,
  privateKey: KeyObject,
  payload: object = { sub: 'user_1', exp: now + 3600 },
  header: object = {},
): string {
  const input = unsigned({ alg: algorithm, typ: 'JWT', ...header }, payload);
  const hash = `sha${algorithm.slice(2)}`;
  let signature: Buffer;

  if (algorithm.startsWith('RS')) signature = sign(hash, Buffer.from(input), privateKey);
  else if (algorithm.startsWith('PS'))
    signature = sign(hash, Buffer.from(input), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: Number(algorithm.slice(2)) / 8,
    });
  else if (algorithm.startsWith('ES'))
    signature = sign(hash, Buffer.from(input), { dsaEncoding: 'ieee-p1363', key: privateKey });
  else signature = sign(null, Buffer.from(input), privateKey);

  return `${input}.${base64Url(signature)}`;
}

function nodeVerifies(token: string, algorithm: string, publicKey: KeyObject): boolean {
  const [header, payload, signature] = token.split('.');
  const data = Buffer.from(`${header}.${payload}`);
  const bytes = Buffer.from(signature!, 'base64url');
  const hash = `sha${algorithm.slice(2)}`;

  if (algorithm.startsWith('RS')) return verify(hash, data, publicKey, bytes);
  if (algorithm.startsWith('PS'))
    return verify(
      hash,
      data,
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: Number(algorithm.slice(2)) / 8,
      },
      bytes,
    );
  if (algorithm.startsWith('ES'))
    return verify(hash, data, { dsaEncoding: 'ieee-p1363', key: publicKey }, bytes);

  return verify(null, data, publicKey, bytes);
}

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const curves = {
  ES256: generateKeyPairSync('ec', { namedCurve: 'P-256' }),
  ES384: generateKeyPairSync('ec', { namedCurve: 'P-384' }),
  ES512: generateKeyPairSync('ec', { namedCurve: 'P-521' }),
};
const ed25519 = generateKeyPairSync('ed25519');
const spki = (key: KeyObject) => key.export({ format: 'pem', type: 'spki' }).toString();
const pkcs8 = (key: KeyObject) => key.export({ format: 'pem', type: 'pkcs8' }).toString();
const jwk = (key: KeyObject, extra: object = {}) =>
  JSON.stringify({ ...key.export({ format: 'jwk' }), ...extra });

describe('JWT decoding', () => {
  it('decodes header, payload and readable time claims without verifying', () => {
    const token = `${unsigned({ alg: 'HS256', typ: 'JWT' }, { sub: '1', iat: now - 7200, nbf: now - 7200, exp: now + 3 * 86_400 })}.${base64Url('x'.repeat(32))}`;
    const decoded = decodeJwt(`Authorization: Bearer ${token}`, { nowSeconds: now });

    assert.deepEqual(decoded.payload, {
      sub: '1',
      iat: now - 7200,
      nbf: now - 7200,
      exp: now + 3 * 86_400,
    });

    assert.equal(decoded.signature, 'not verified (32 bytes); choose Verify and enter the key');
    assert.equal(decoded.times.iat, '2025-10-09T06:53:20Z (2 hours ago)');
    assert.equal(decoded.times.exp, '2025-10-12T08:53:20Z (in 3 days)');
    assert.equal(decoded.timing, 'valid');
    assert.deepEqual(decoded.warnings, []);
  });

  it('reports expiry, future claims, milliseconds and unsigned tokens', () => {
    const expired = decodeJwt(
      `${unsigned({ alg: 'none' }, { exp: now - 60, iat: (now + 600) * 1000 })}.`,
      { nowSeconds: now },
    );

    assert.equal(expired.timing, 'expired');
    assert.equal(expired.signature, 'none (unsigned token)');
    assert.match(expired.warnings.join('\n'), /alg is "none"/);
    assert.match(expired.warnings.join('\n'), /iat looks like milliseconds/);
    assert.match(expired.warnings.join('\n'), /iat is in \d+ years, in the future/);

    assert.equal(
      decodeJwt(`${unsigned({ alg: 'none' }, { exp: now - 60 })}.`, {
        clockToleranceSeconds: 120,
        nowSeconds: now,
      }).timing,
      'valid',
    );

    assert.equal(
      decodeJwt(`${unsigned({ alg: 'HS256' }, { nbf: now + 600, exp: now + 900 })}.c2ln`, {
        nowSeconds: now,
      }).timing,
      'not yet valid',
    );

    assert.match(
      decodeJwt(`${unsigned({ alg: 'HS256' }, { sub: 'x' })}.c2ln`).warnings.join(),
      /never expires/,
    );
  });

  it('reads JWE headers, two-segment tokens and padding without crashing', () => {
    const jwe = decodeJwt(
      `${base64Url(JSON.stringify({ alg: 'RSA-OAEP', enc: 'A256GCM' }))}.a.b.c.d`,
    );

    assert.equal(jwe.payload, null);
    assert.match(jwe.warnings[0]!, /encrypted JWE \(5 segments, enc A256GCM\)/);

    assert.match(
      decodeJwt(unsigned({ alg: 'HS256' }, { exp: now })).warnings.join(),
      /signature segment is missing/,
    );

    assert.match(
      decodeJwt(`${base64Url('{"alg":"HS256"}')}==.${base64Url('{"a":1}')}.`).warnings.join(),
      /= padding/,
    );

    assert.throws(() => decodeJwt('abc'), jwtError(/three dot-separated segments.*has 1/));
    assert.throws(() => decodeJwt('e30.!!!.x'), jwtError(/Payload segment is not valid Base64URL/));

    assert.throws(
      () => decodeJwt(`${base64Url('[1]')}.e30.`),
      jwtError(/header must be a JSON object/),
    );
  });
});

describe('JWT verification', () => {
  it('does not echo JSON parser details for malformed JWK keys', async () => {
    const token = `${unsigned({ alg: 'HS256', typ: 'JWT' }, { sub: 'ada' })}.c2ln`;
    const error = await verifyJwt(token, '{"d":"nWGxne"', { nowSeconds: now }).catch(
      (caught: unknown) => caught,
    );

    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Key looks like a JWK but is not valid JSON.');
    assert.ok(!error.message.includes('nWGxne'));
  });

  it('treats an exp or nbf outside the date range as malformed', async () => {
    for (const payload of [{ exp: -1e13 }, { nbf: 1e14 }]) {
      const input = unsigned({ alg: 'HS256' }, payload);
      const token = `${input}.${createHmac('sha256', 'a'.repeat(64)).update(input).digest('base64url')}`;
      const result = await verifyJwt(token, 'a'.repeat(64), { nowSeconds: now });

      assert.equal(result.valid, false, JSON.stringify(payload));

      assert.ok(
        result.warnings.some((warning) => warning.includes('outside the representable date range')),
      );
    }
  });

  it('verifies HMAC tokens made by Node and rejects edits, wrong secrets and short-secret warnings', async () => {
    for (const [algorithm, hash] of [
      ['HS256', 'sha256'],
      ['HS384', 'sha384'],
      ['HS512', 'sha512'],
    ] as const) {
      const input = unsigned({ alg: algorithm, typ: 'JWT' }, { sub: 'ada', exp: now + 60 });
      const token = `${input}.${createHmac(hash, 'a'.repeat(64)).update(input).digest('base64url')}`;
      const result = await verifyJwt(token, 'a'.repeat(64), { nowSeconds: now });

      assert.equal(result.valid, true, algorithm);
      assert.equal(result.algorithm, algorithm);
      assert.deepEqual(result.warnings, []);

      assert.equal(
        (await verifyJwt(token, 'b'.repeat(64), { nowSeconds: now })).signature,
        'invalid',
      );
    }

    const input = unsigned({ alg: 'HS256' }, { exp: now + 60 });
    const short = `${input}.${createHmac('sha256', 'secret').update(input).digest('base64url')}`;
    const result = await verifyJwt(short, 'secret', { nowSeconds: now });

    assert.equal(result.valid, true);

    assert.match(
      result.warnings.join(),
      /HS256 secrets should be at least 32 bytes .*this one is 6/,
    );

    assert.equal(result.key, 'HMAC secret · 6 bytes from UTF-8 text');
    const binary = Buffer.from('00ff'.repeat(16), 'hex');
    const binaryToken = `${input}.${createHmac('sha256', binary).update(input).digest('base64url')}`;

    assert.equal(
      (await verifyJwt(binaryToken, '00ff'.repeat(16), { nowSeconds: now, secretEncoding: 'hex' }))
        .valid,
      true,
    );

    assert.equal(
      (
        await verifyJwt(binaryToken, binary.toString('base64'), {
          nowSeconds: now,
          secretEncoding: 'base64',
        })
      ).valid,
      true,
    );

    assert.equal(
      (
        await verifyJwt(
          binaryToken,
          JSON.stringify({ k: binary.toString('base64url'), kty: 'oct' }),
          { nowSeconds: now },
        )
      ).valid,
      true,
    );

    const edited = `${unsigned({ alg: 'HS256' }, { exp: now + 61 })}.${short.split('.')[2]}`;

    assert.match(
      (await verifyJwt(edited, 'secret', { nowSeconds: now })).reason ?? '',
      /does not match this key/,
    );
  });

  it('verifies RSA, RSA-PSS, ECDSA and Ed25519 tokens made by Node from PEM, JWK and JWKS keys', async () => {
    for (const algorithm of ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512']) {
      const token = nodeToken(algorithm, rsa.privateKey);

      assert.equal(
        (await verifyJwt(token, spki(rsa.publicKey), { nowSeconds: now })).valid,
        true,
        algorithm,
      );
    }

    const rs256 = nodeToken('RS256', rsa.privateKey, undefined, { kid: 'rsa-1' });
    const pkcs1 = rsa.publicKey.export({ format: 'pem', type: 'pkcs1' }).toString();
    const viaPkcs1 = await verifyJwt(rs256, pkcs1, { nowSeconds: now });

    assert.equal(viaPkcs1.valid, true);
    assert.equal(viaPkcs1.key, 'RSA public key · 2048-bit · PKCS#1 PEM');
    assert.equal((await verifyJwt(rs256, jwk(rsa.publicKey), { nowSeconds: now })).valid, true);
    assert.equal((await verifyJwt(rs256, pkcs8(rsa.privateKey), { nowSeconds: now })).valid, true);
    const jwks = JSON.stringify({
      keys: [
        JSON.parse(jwk(curves.ES256.publicKey, { kid: 'ec-1' })),
        JSON.parse(jwk(rsa.publicKey, { kid: 'rsa-1', use: 'sig' })),
      ],
    });
    const viaJwks = await verifyJwt(rs256, jwks, { nowSeconds: now });

    assert.equal(viaJwks.valid, true);
    assert.equal(viaJwks.key, 'RSA public key · 2048-bit · JWK kid=rsa-1');

    await assert.rejects(
      () => verifyJwt(nodeToken('RS256', rsa.privateKey, undefined, { kid: 'missing' }), jwks),
      jwtError(/no signing key with kid "missing"; it has ec-1, rsa-1/),
    );

    for (const [algorithm, pair] of Object.entries(curves)) {
      const token = nodeToken(algorithm, pair.privateKey);

      assert.equal(
        (await verifyJwt(token, spki(pair.publicKey), { nowSeconds: now })).valid,
        true,
        algorithm,
      );

      assert.equal(
        (await verifyJwt(token, jwk(pair.publicKey), { nowSeconds: now })).valid,
        true,
        algorithm,
      );
    }

    const sec1 = curves.ES256.privateKey.export({ format: 'pem', type: 'sec1' }).toString();

    assert.equal(
      (await verifyJwt(nodeToken('ES256', curves.ES256.privateKey), sec1, { nowSeconds: now }))
        .valid,
      true,
    );

    for (const algorithm of ['EdDSA', 'Ed25519']) {
      const token = nodeToken(algorithm, ed25519.privateKey);

      assert.equal(
        (await verifyJwt(token, spki(ed25519.publicKey), { nowSeconds: now })).valid,
        true,
        algorithm,
      );

      assert.equal(
        (await verifyJwt(token, jwk(ed25519.privateKey), { nowSeconds: now })).valid,
        true,
        algorithm,
      );
    }
  });

  it('refuses algorithm confusion, unsigned tokens and mismatched curves', async () => {
    const input = unsigned({ alg: 'HS256' }, { exp: now + 60 });
    const forged = `${input}.${createHmac('sha256', spki(rsa.publicKey)).update(input).digest('base64url')}`;

    await assert.rejects(
      () => verifyJwt(forged, spki(rsa.publicKey)),
      jwtError(/HS256 needs a shared secret, but this is an RSA public key.*algorithm-confusion/),
    );

    const pinned = await verifyJwt(forged, spki(rsa.publicKey), {
      algorithm: 'RS256',
      nowSeconds: now,
    });

    assert.equal(pinned.valid, false);
    assert.match(pinned.reason ?? '', /header says HS256, but RS256 was expected/);
    const none = await verifyJwt(`${unsigned({ alg: 'none' }, { exp: now + 60 })}.`, 'secret');

    assert.equal(none.signature, 'invalid');
    assert.match(none.reason ?? '', /never accepted/);

    await assert.rejects(
      () => verifyJwt(nodeToken('ES256', curves.ES256.privateKey), spki(curves.ES384.publicKey)),
      jwtError(/ES256 needs a P-256 key, but this is a P-384 public key/),
    );

    await assert.rejects(
      () => verifyJwt(nodeToken('RS256', rsa.privateKey), 'shared-secret'),
      jwtError(/RS256 needs an RSA key .*not a shared secret/),
    );

    await assert.rejects(
      () =>
        verifyJwt(
          nodeToken('RS256', rsa.privateKey),
          JSON.stringify({ ...JSON.parse(jwk(rsa.publicKey)), alg: 'PS256' }),
        ),
      jwtError(/marked for PS256, not RS256/),
    );

    const der =
      nodeToken('ES256', curves.ES256.privateKey).split('.').slice(0, 2).join('.') +
      `.${base64Url(Buffer.concat([Buffer.from([0x30, 0x44]), Buffer.alloc(68, 1)]))}`;

    assert.match(
      (await verifyJwt(der, spki(curves.ES256.publicKey))).reason ?? '',
      /64 bytes; this one is 70, probably DER-encoded/,
    );
  });

  it('keeps a valid signature but marks expired or future tokens invalid overall', async () => {
    const expired = await verifyJwt(
      nodeToken('RS256', rsa.privateKey, { exp: now - 1 }),
      spki(rsa.publicKey),
      { nowSeconds: now },
    );

    assert.equal(expired.signature, 'valid');
    assert.equal(expired.timing, 'expired');
    assert.equal(expired.valid, false);
    const early = await verifyJwt(
      nodeToken('RS256', rsa.privateKey, { exp: now + 120, nbf: now + 60 }),
      spki(rsa.publicKey),
      { nowSeconds: now },
    );

    assert.equal(early.timing, 'not yet valid');

    assert.equal(
      (
        await verifyJwt(
          nodeToken('RS256', rsa.privateKey, { exp: now + 120, nbf: now + 60 }),
          spki(rsa.publicKey),
          { clockToleranceSeconds: 60, nowSeconds: now },
        )
      ).valid,
      true,
    );
  });
});

describe('JWT signing', () => {
  it('signs every algorithm so Node verifies the result', async () => {
    const cases: Array<[string, string, KeyObject]> = [
      ['RS256', pkcs8(rsa.privateKey), rsa.publicKey],
      ['PS384', rsa.privateKey.export({ format: 'pem', type: 'pkcs1' }).toString(), rsa.publicKey],
      [
        'ES256',
        curves.ES256.privateKey.export({ format: 'pem', type: 'sec1' }).toString(),
        curves.ES256.publicKey,
      ],
      ['ES384', jwk(curves.ES384.privateKey), curves.ES384.publicKey],
      ['ES512', pkcs8(curves.ES512.privateKey), curves.ES512.publicKey],
      ['EdDSA', pkcs8(ed25519.privateKey), ed25519.publicKey],
    ];

    for (const [algorithm, key, publicKey] of cases) {
      const signed = await signJwt('{"sub":"user_1"}', key, {
        algorithm:
          algorithm.startsWith('ES') || algorithm === 'EdDSA' ? 'auto' : (algorithm as 'RS256'),
      });

      assert.equal(signed.algorithm, algorithm);
      assert.equal(nodeVerifies(signed.token, algorithm, publicKey), true, algorithm);
    }
  });

  it('labels an unrecognised secret encoding as the Base64 it is decoded as', async () => {
    const signed = await signJwt('{"sub":"user_1"}', 'k'.repeat(32), {
      secretEncoding: 'legacy' as JwtSecretEncoding,
    });

    assert.match(signed.key, /from Base64$/);
  });

  it('adds iat, exp, header parameters and JWK kid in a stable order', async () => {
    const signed = await signJwt('{"sub":"user_1","exp":1}', 'k'.repeat(32), {
      expiresIn: '1h30m',
      header: '{"kid":"key-1","typ":"at+jwt"}',
      issuedAt: true,
      nowSeconds: now,
    });

    assert.deepEqual(signed.header, { alg: 'HS256', typ: 'at+jwt', kid: 'key-1' });
    assert.deepEqual(signed.payload, { sub: 'user_1', exp: now + 5400, iat: now });
    const [, , signature] = signed.token.split('.');

    assert.equal(
      signature,
      createHmac('sha256', 'k'.repeat(32))
        .update(signed.token.split('.').slice(0, 2).join('.'))
        .digest('base64url'),
    );

    assert.equal((await verifyJwt(signed.token, 'k'.repeat(32), { nowSeconds: now })).valid, true);
    const withKid = await signJwt('{}', jwk(curves.ES256.privateKey, { kid: 'ec-2026' }));

    assert.deepEqual(withKid.header, { alg: 'ES256', typ: 'JWT', kid: 'ec-2026' });

    assert.equal(
      (await signJwt('{}', 'k'.repeat(64), { header: '{"alg":"HS512"}' })).algorithm,
      'HS512',
    );

    assert.match((await signJwt('{}', 'short')).warnings.join(), /at least 32 bytes/);
  });

  it('explains wrong payloads, headers, durations and public keys', async () => {
    await assert.rejects(
      () => signJwt('eyJhbGciOiJIUzI1NiJ9.e30.abc', 'secret'),
      jwtError(/looks like a JWT/),
    );

    await assert.rejects(() => signJwt('[1]', 'secret'), jwtError(/must be a JSON object/));

    await assert.rejects(
      () => signJwt('{}', 'secret', { algorithm: 'HS256', header: '{"alg":"RS256"}' }),
      jwtError(/header JSON says RS256, but HS256 is selected/),
    );

    await assert.rejects(
      () => signJwt('{}', 'secret', { header: '{"alg":"none"}' }),
      jwtError(/not created here/),
    );

    await assert.rejects(() => signJwt('{}', spki(rsa.publicKey)), jwtError(/needs a private key/));

    await assert.rejects(
      () => signJwt('{}', 'secret', { expiresIn: 'soon' }),
      jwtError(/duration such as 15m/),
    );

    await assert.rejects(
      () =>
        signJwt(
          '{}',
          '-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----',
        ),
      jwtError(/need their passphrase/),
    );

    assert.equal(parseJwtDuration('90'), 90);
    assert.equal(parseJwtDuration('2w 1d'), 15 * 86_400);
    assert.throws(() => parseJwtDuration('0'), jwtError(/between 1 second and 100 years/));
  });
});
