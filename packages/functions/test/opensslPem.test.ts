import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'vitest';
import { convertPemToJwk, decodeCsr, inspectCertificate, inspectPemKey } from '../src/crypto';
import { parseJwtKey } from '../src/crypto/jwtKeys';
import {
  certificateFullSan,
  certificateT61,
  certificateYears40To60,
  csrCaPathLength,
  csrOtherNameSan,
  csrRsa2047,
  csrT61,
  publicKeyExplicitEc,
  publicKeyRsa2047,
  publicKeyRsaPss,
} from './fixtures/opensslPem';

const ecParameters =
  '-----BEGIN EC PARAMETERS-----\nBggqhkjOPQMBBw==\n-----END EC PARAMETERS-----\n';

function ecKeyFromEcparam(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

  return `${ecParameters}${String(privateKey.export({ format: 'pem', type: 'sec1' }))}`;
}

describe('PEM tools against OpenSSL output', () => {
  it('lists otherName and registeredID subject alternative names', async () => {
    const report = await decodeCsr(csrOtherNameSan);

    assert.deepEqual(report.extensions.subjectAltNames, [
      'otherName:1.3.6.1.4.1.311.20.2.3:user@corp',
    ]);

    assert.ok(!report.findings.some((finding) => /No subjectAltName/.test(finding.message)));

    const certificate = await inspectCertificate(certificateFullSan);

    assert.match(
      String(certificate.subjectAltName),
      /, otherName:1\.3\.6\.1\.4\.1\.311\.20\.2\.3:user@corp, RID:1\.2\.3\.4$/,
    );
  });

  it('prints the serial number without the DER sign byte', async () => {
    assert.equal((await inspectCertificate(certificateFullSan)).serialNumber, '8FABCDEF0123456789');
  });

  it('keeps the path length of basicConstraints', async () => {
    const withCa = await decodeCsr(csrCaPathLength);
    const withoutCa = await decodeCsr(csrRsa2047);

    assert.equal(withCa.extensions.basicConstraints, 'CA:TRUE, pathlen:2');
    assert.equal(withoutCa.extensions.basicConstraints, 'CA:FALSE, pathlen:0');
  });

  it('decodes T61String names as Latin-1', async () => {
    assert.equal((await decodeCsr(csrT61)).subject, 'CN=Tést, O=Café');
    assert.equal((await inspectCertificate(certificateT61)).subject, 'CN=Tést\nO=Café');
  });

  it('compares certificate dates before year 100 by their real year', async () => {
    const certificate = await inspectCertificate(certificateYears40To60);

    assert.equal(certificate.validityStatus, 'expired');
  });

  it('counts RSA modulus bits exactly', async () => {
    const report = await decodeCsr(csrRsa2047);
    const pkcs1 = String(
      createPublicKey(publicKeyRsa2047).export({ format: 'pem', type: 'pkcs1' }),
    );

    assert.equal(report.publicKey.details.bits, 2047);
    assert.ok(report.findings.some((finding) => /2,047 bits/.test(finding.message)));
    assert.deepEqual((await inspectPemKey(publicKeyRsa2047)).details, { modulusLength: 2047 });
    assert.deepEqual((await inspectPemKey(pkcs1)).details, { modulusLength: 2047 });
  });

  it('labels explicit EC parameters instead of reading them as an OID', async () => {
    assert.deepEqual((await inspectPemKey(publicKeyExplicitEc)).details, {
      namedCurve: 'explicit parameters',
    });

    assert.throws(() => parseJwtKey(publicKeyExplicitEc), /does not name its curve/);
  });

  it('reads the default output of openssl ecparam -genkey', async () => {
    const pem = ecKeyFromEcparam();

    assert.equal((await inspectPemKey(pem)).algorithm, 'ec');
    assert.equal((await convertPemToJwk(pem)).jwk.crv, 'P-256');
  });

  it('still refuses EC parameters without a key and two keys together', async () => {
    const pem = ecKeyFromEcparam();

    await assert.rejects(inspectPemKey(ecParameters), /not a supported public\/private key/);
    assert.throws(() => parseJwtKey(ecParameters), /Unsupported PEM block "EC PARAMETERS"/);
    await assert.rejects(inspectPemKey(`${pem}${publicKeyRsa2047}`), /exactly one PEM key/);
  });

  it('explains that RSA-PSS PEM keys cannot be converted', async () => {
    await assert.rejects(convertPemToJwk(publicKeyRsaPss), /RSA-PSS PEM keys cannot be converted/);
  });
});
