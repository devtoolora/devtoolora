import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'vitest';
import {
  analyzeCertificateChain,
  inspectCertificate,
  inspectPemKey,
  scorePassword,
} from '../src/crypto';

describe('crypto inspection boundaries', () => {
  it('distinguishes supported signatures from trust and rejects invalid calendar data', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const der = (tag: number, content: Buffer): Buffer =>
      Buffer.concat([
        Buffer.from(
          content.length < 128
            ? [tag, content.length]
            : content.length < 256
              ? [tag, 0x81, content.length]
              : [tag, 0x82, content.length >> 8, content.length & 255],
        ),
        content,
      ]);
    const algorithm = Buffer.from('300d06092a864886f70d01010b0500', 'hex');

    const certificate = (from: string, to: string): string => {
      const tbs = der(
        0x30,
        Buffer.concat([
          Buffer.from([2, 1, 1]),
          algorithm,
          der(0x30, Buffer.alloc(0)),
          der(0x30, Buffer.concat([der(0x17, Buffer.from(from)), der(0x17, Buffer.from(to))])),
          der(0x30, Buffer.alloc(0)),
          publicKey.export({ format: 'der', type: 'spki' }),
        ]),
      );
      const bytes = der(
        0x30,
        Buffer.concat([
          tbs,
          algorithm,
          der(3, Buffer.concat([Buffer.from([0]), sign('sha256', tbs, privateKey)])),
        ]),
      );

      return `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64')}\n-----END CERTIFICATE-----`;
    };

    const pem = certificate('260101000000Z', '360101000000Z');

    assert.equal((await inspectCertificate(pem)).trustEstablished, false);
    const validityOf = async (from: string, to: string): Promise<unknown> =>
      (await inspectCertificate(certificate(from, to))).validityStatus;

    assert.equal(await validityOf('200101000000Z', '210101000000Z'), 'expired');
    assert.equal(await validityOf('200101000000Z', '480101000000Z'), 'valid');
    assert.equal(await validityOf('480101000000Z', '490101000000Z'), 'not-yet-valid');
    const chain = await analyzeCertificateChain(pem);

    assert.equal(chain.trustEstablished, false);
    assert.deepEqual(chain.links, []);
    assert.deepEqual(chain.terminal, { selfSignatureVerified: true, subjectMatchesIssuer: true });
    await assert.rejects(() => inspectCertificate(pem + pem), /exactly one/);

    await assert.rejects(
      () => inspectCertificate(certificate('261301000000Z', '360101000000Z')),
      /calendar date/,
    );

    await assert.rejects(
      () => inspectCertificate(certificate('360101000000Z', '260101000000Z')),
      /expiry precedes/,
    );
  });

  it('prints IPv6, email and directory-name SANs and names EC curves and signatures', async () => {
    const der = (tag: number, content: Buffer): Buffer =>
      Buffer.concat([
        Buffer.from(
          content.length < 128
            ? [tag, content.length]
            : content.length < 256
              ? [tag, 0x81, content.length]
              : [tag, 0x82, content.length >> 8, content.length & 255],
        ),
        content,
      ]);
    const directoryName = der(
      0x30,
      Buffer.concat([
        der(
          0x31,
          der(
            0x30,
            Buffer.concat([
              Buffer.from('0603550403', 'hex'),
              der(0x0c, Buffer.from('Example Device')),
            ]),
          ),
        ),
        der(
          0x31,
          der(
            0x30,
            Buffer.concat([
              Buffer.from('060355040a', 'hex'),
              der(0x0c, Buffer.from('Example Org')),
            ]),
          ),
        ),
      ]),
    );
    const names = der(
      0x30,
      Buffer.concat([
        der(0x82, Buffer.from('example.test')),
        der(0x87, Buffer.from([192, 0, 2, 1])),
        der(0x87, Buffer.from('20010db8000000000000000000000001', 'hex')),
        der(0x87, Buffer.from('fe800000000000000001000000000001', 'hex')),
        der(0x87, Buffer.from('00000000000000000000000000000001', 'hex')),
        der(0x81, Buffer.from('admin@example.test')),
        der(0xa4, directoryName),
      ]),
    );
    const extensions = der(
      0xa3,
      der(0x30, der(0x30, Buffer.concat([Buffer.from('0603551d11', 'hex'), der(0x04, names)]))),
    );
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const algorithm = Buffer.from('300a06082a8648ce3d040302', 'hex');
    const validity = der(
      0x30,
      Buffer.concat([
        der(0x17, Buffer.from('260101000000Z')),
        der(0x17, Buffer.from('360101000000Z')),
      ]),
    );
    const subject = der(
      0x30,
      Buffer.concat([
        der(
          0x31,
          der(
            0x30,
            Buffer.concat([
              Buffer.from('06092a864886f70d010901', 'hex'),
              der(0x16, Buffer.from('admin@example.test')),
            ]),
          ),
        ),
        der(
          0x31,
          der(
            0x30,
            Buffer.concat([
              Buffer.from('060355040a', 'hex'),
              der(0x1e, Buffer.from('004f00720067', 'hex')),
            ]),
          ),
        ),
      ]),
    );
    const tbs = der(
      0x30,
      Buffer.concat([
        Buffer.from([2, 1, 1]),
        algorithm,
        subject,
        validity,
        subject,
        ec.publicKey.export({ format: 'der', type: 'spki' }),
        extensions,
      ]),
    );
    const bytes = der(
      0x30,
      Buffer.concat([
        tbs,
        algorithm,
        der(3, Buffer.concat([Buffer.from([0]), sign('sha256', tbs, ec.privateKey)])),
      ]),
    );
    const pem = `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64')}\n-----END CERTIFICATE-----`;
    const report = await inspectCertificate(pem);

    assert.equal(report.signatureAlgorithm, 'ecdsa-with-SHA256');
    assert.equal(report.subject, 'emailAddress=admin@example.test\nO=Org');

    assert.deepEqual((await analyzeCertificateChain(pem)).terminal, {
      selfSignatureVerified: true,
      subjectMatchesIssuer: true,
    });

    assert.equal(
      report.subjectAltName,
      'DNS:example.test, IP:192.0.2.1, IP:2001:db8::1, IP:fe80::1:0:0:1, IP:::1, email:admin@example.test, DirName:/CN=Example Device/O=Example Org',
    );

    assert.deepEqual((report.publicKey as { details: unknown }).details, { namedCurve: 'P-256' });

    for (const [curve, name] of [
      ['prime256v1', 'P-256'],
      ['secp384r1', 'P-384'],
      ['secp521r1', 'P-521'],
      ['secp256k1', 'secp256k1'],
    ]) {
      const key = generateKeyPairSync('ec', { namedCurve: curve! })
        .publicKey.export({ format: 'pem', type: 'spki' })
        .toString();

      assert.deepEqual((await inspectPemKey(key)).details, { namedCurve: name }, curve);
    }
  });

  it('counts look-alike substitutions in the common-start check', () => {
    for (const value of [
      'P@ssw0rd2024!',
      'Adm1n!Secure#99',
      'W3lc0me-Home-2024',
      '1etme1n-Now-2024!',
    ]) {
      const report = scorePassword(value);

      assert.equal((report.checks as Record<string, boolean>).commonPattern, true, value);
      assert.equal(report.rating, 'weak', value);
    }

    assert.equal(
      (scorePassword('Correct-Horse-42!').checks as Record<string, boolean>).commonPattern,
      false,
    );
  });

  it('preserves whitespace/code points and reports checklist limitations without exposing passwords', () => {
    const password = ' leading spaces ';
    const report = scorePassword(password);

    assert.equal(report.length, [...password].length);
    assert.equal(report.method, 'heuristic-checklist');
    assert.match(String(report.notice), /No breach lookup/);
    assert.ok(!JSON.stringify(report).includes(password));
    assert.equal(scorePassword('🐎kůň漢字42!').length, 9);
    for (const value of ['Password123!', 'Aa1!Aa1!Aa1!Aa1!Aa1!', '     '])
      assert.equal(scorePassword(value).rating, 'weak');
    assert.throws(() => scorePassword(''));
    assert.throws(() => scorePassword('a'.repeat(10001)));
  });

  it('recognizes supported RSA/EC containers and separates public fingerprint formats', async () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const spki = await inspectPemKey(
      rsa.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    );

    assert.equal(spki.fingerprintFormat, 'SPKI DER');
    const pkcs1 = await inspectPemKey(
      rsa.publicKey.export({ format: 'pem', type: 'pkcs1' }).toString(),
    );

    assert.equal(pkcs1.kind, 'public');
    assert.equal(pkcs1.algorithm, 'rsa');
    assert.equal(pkcs1.fingerprintFormat, 'PKCS#1 DER');
    assert.notEqual(pkcs1.publicKeyFingerprintSha256, spki.publicKeyFingerprintSha256);

    for (const type of ['pkcs1', 'pkcs8'] as const) {
      const pem = rsa.privateKey.export({ format: 'pem', type }).toString();
      const report = await inspectPemKey(pem);

      assert.equal(report.algorithm, 'rsa');
      assert.equal(report.kind, 'private');
      assert.ok(!JSON.stringify(report).includes(pem.split('\n')[1]!));
    }

    assert.equal(
      (await inspectPemKey(ec.privateKey.export({ format: 'pem', type: 'sec1' }).toString()))
        .algorithm,
      'ec',
    );
  });

  it('detects encrypted PKCS#8 and legacy PEM headers without decrypting', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });

    for (const type of ['pkcs1', 'pkcs8'] as const) {
      const pem = privateKey
        .export({ cipher: 'aes-256-cbc', format: 'pem', passphrase: 'public-fixture-only', type })
        .toString();
      const report = await inspectPemKey(pem);

      assert.equal(report.encryptedPrivateKey, true);
      assert.equal(report.algorithm, 'encrypted');
      assert.ok(!JSON.stringify(report).includes('public-fixture-only'));
    }
  });

  it('rejects misleading labels, malformed ASN.1 and trailing key containers', async () => {
    for (const [label, bytes] of [
      ['CERTIFICATE', Buffer.from([0x30, 0])],
      ['PRIVATE KEY', Buffer.from([0x30, 0x80, 0, 0])],
      ['PRIVATE KEY', Buffer.from([0x30, 0x82, 1])],
      ['PUBLIC KEY', Buffer.from([0x30, 0, 0])],
      ['PRIVATE KEY', Buffer.from([0x30, 0])],
    ] as const) {
      await assert.rejects(() =>
        inspectPemKey(
          `-----BEGIN ${label}-----\n${bytes.toString('base64')}\n-----END ${label}-----`,
        ),
      );
    }

    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const pem = publicKey.export({ format: 'pem', type: 'spki' }).toString();

    await assert.rejects(() => inspectPemKey(pem + pem));

    await assert.rejects(() =>
      inspectCertificate('-----BEGIN CERTIFICATE-----\nMAA=\n-----END CERTIFICATE-----'),
    );
  });
});
