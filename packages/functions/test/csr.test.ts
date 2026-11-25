import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { decodeCsr } from '../src/crypto';
import {
  csrChallenge,
  csrEcPlain,
  csrNewHeader,
  csrRsaSan,
  csrSha1,
  csrWeakRsa,
} from './fixtures/csr';

describe('CSR decoder', () => {
  it('decodes subject, SANs, key, extensions and verifies the signature', async () => {
    const report = await decodeCsr(csrRsaSan);

    assert.equal(report.version, 0);
    assert.equal(report.subject, 'CN=api.example.com, O=Dev Toolora, C=US');

    assert.deepEqual(report.extensions.subjectAltNames, [
      'DNS:api.example.com',
      'DNS:www.example.com',
      'IP:10.0.0.1',
    ]);

    assert.deepEqual(report.extensions.keyUsage, ['digitalSignature', 'keyEncipherment']);
    assert.deepEqual(report.extensions.extendedKeyUsage, ['serverAuth']);
    assert.equal(report.publicKey.algorithm, 'RSA');
    assert.equal(report.publicKey.details.bits, 2048);
    assert.equal(report.signatureAlgorithm, 'sha256WithRSAEncryption');
    assert.equal(report.signatureValid, true);
    assert.match(report.fingerprintSha256, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    assert.deepEqual(report.findings, []);
    assert.deepEqual(await decodeCsr(csrNewHeader), report);
  });

  it('decodes unusual subjects and unknown attributes', async () => {
    const report = await decodeCsr(csrChallenge);

    assert.ok(
      report.subjectAttributes.some((a) => a.name === 'O' && a.value === 'Žluťoučký kůň s.r.o.'),
    );

    assert.equal(
      report.subject,
      'CN=utf8.example.test, O=Žluťoučký kůň s.r.o., OU=Platform+0.9.2342.19200300.100.1.1=dev42',
    );

    assert.deepEqual(report.attributes, ['1.2.840.113549.1.9.2']);
    assert.equal(report.challengePassword, true);
    assert.ok(!JSON.stringify(report).includes('hunter2'));

    assert.ok(
      report.findings.some(
        (f) =>
          f.level === 'info' && f.message === 'The request carries a challengePassword attribute.',
      ),
    );

    const ec = await decodeCsr(csrEcPlain);

    assert.deepEqual(
      [ec.publicKey.algorithm, ec.publicKey.details.curve, ec.signatureValid],
      ['EC', 'P-256', true],
    );

    assert.equal(ec.signatureAlgorithm, 'ecdsa-with-SHA256');

    assert.ok(
      ec.findings.some(
        (f) => f.level === 'medium' && f.message === 'No subjectAltName; browsers ignore the CN.',
      ),
    );
  });

  it('flags weak signatures and tampering', async () => {
    assert.ok(
      (await decodeCsr(csrSha1)).findings.some(
        (f) =>
          f.level === 'high' &&
          f.message === 'Signed with SHA-1; certificate authorities reject it.',
      ),
    );

    const lines = csrRsaSan.trim().split('\n');
    const body = lines.slice(1, -1).join('');
    const bytes = Buffer.from(body, 'base64');

    bytes[bytes.length - 1]! ^= 0x01;
    const tampered = `${lines[0]}\n${bytes
      .toString('base64')
      .match(/.{1,64}/g)
      ?.join('\n')}\n${lines.at(-1)}\n`;

    assert.equal((await decodeCsr(tampered)).signatureValid, false);
  });

  it('flags short RSA keys and a CN missing from the SANs', async () => {
    const report = await decodeCsr(csrWeakRsa);

    assert.deepEqual(report.findings, [
      { level: 'medium', message: 'The RSA key has 1,024 bits; use at least 2,048.' },
      { level: 'low', message: 'The CN is not listed in the subjectAltName.' },
    ]);

    assert.deepEqual(report.extensions, {
      basicConstraints: 'CA:FALSE',
      extendedKeyUsage: ['clientAuth', '1.3.6.1.4.1.311.10.3.12'],
      subjectAltNames: [
        'DNS:other.example.test',
        'email:ops@example.test',
        'URI:https://example.test/',
      ],
    });
  });

  it('rejects other inputs', async () => {
    await assert.rejects(decodeCsr('hello'), /Paste a PEM CERTIFICATE REQUEST block\./);

    await assert.rejects(
      decodeCsr('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'),
      /Paste a PEM CERTIFICATE REQUEST block\./,
    );

    await assert.rejects(
      decodeCsr('-----BEGIN CERTIFICATE REQUEST-----\nAAAA\n-----END CERTIFICATE REQUEST-----'),
      /not valid DER/,
    );
  });
});
