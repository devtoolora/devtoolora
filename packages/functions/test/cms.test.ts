import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { decodeCmsSignedData } from '../src/crypto/cms';
import { ecCurveNames, oid, parseAsn1 } from '../src/crypto/pemAsn1';
import { FunctionError } from '../src/errors';
import { keyIdCadesCms, signedBerPdf, signedDerPdf, signedEditedPdf } from './fixtures/signedPdf';

const sampleSigner = 'CN=Sample Signer\nO=Dev Toolora\nC=CZ';

function signatureContents(pdfBase64: string): Uint8Array {
  const text = Buffer.from(pdfBase64, 'base64').toString('latin1');
  const contents = /\/Contents\s*<([0-9A-Fa-f]+)>/.exec(text)?.[1] ?? '';

  return new Uint8Array(Buffer.from(contents, 'hex'));
}

function der(tag: number, ...content: number[][]): number[] {
  const body = content.flat();

  return [tag, body.length, ...body];
}

function isFunctionError(error: unknown): boolean {
  return error instanceof FunctionError;
}

describe('BER ASN.1 parsing', () => {
  it('parses an indefinite-length constructed value only with the ber option', () => {
    const bytes = Uint8Array.of(0x30, 0x80, 0x02, 0x01, 0x05, 0x00, 0x00);
    const node = parseAsn1(bytes, { ber: true });

    assert.equal(node.children.length, 1);
    assert.equal(node.children[0]?.tag, 0x02);
    assert.equal(node.valueEnd, 5);
    assert.equal(node.end, 7);
    assert.throws(() => parseAsn1(bytes), isFunctionError);
  });

  it('parses nested indefinite lengths and rejects malformed BER', () => {
    const nested = parseAsn1(
      Uint8Array.of(0x30, 0x80, 0xa0, 0x80, 0x02, 0x01, 0x07, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00),
      { ber: true },
    );

    assert.deepEqual(
      nested.children.map((child) => [child.tag, child.end]),
      [
        [0xa0, 9],
        [0x05, 11],
      ],
    );

    assert.equal(nested.children[0]?.children[0]?.tag, 0x02);
    assert.equal(nested.end, 13);

    assert.throws(() => parseAsn1(Uint8Array.of(0x04, 0x80, 0x00, 0x00), { ber: true }), {
      message: 'Invalid ASN.1 length header.',
    });

    assert.throws(() => parseAsn1(Uint8Array.of(0x30, 0x80, 0x02, 0x01, 0x05), { ber: true }), {
      message: 'Truncated or excessively nested ASN.1 data.',
    });

    assert.throws(() => parseAsn1(Uint8Array.of(0x30, 0x80, 0x00), { ber: true }), isFunctionError);
  });

  it('caps indefinite-length nesting depth', () => {
    const bytes = new Uint8Array(200).fill(0x30);

    bytes.forEach((_byte, index) => {
      if (index % 2 === 1) bytes[index] = 0x80;
    });

    assert.throws(() => parseAsn1(bytes, { ber: true }), {
      message: 'Truncated or excessively nested ASN.1 data.',
    });
  });
});

describe('CMS SignedData decoding', () => {
  it('decodes the reference PDF signer from DER, BER and an edited file alike', async () => {
    const expected = {
      certificates: [sampleSigner],
      signers: [
        {
          certificate: {
            fingerprintSha256:
              '4E:1C:F7:22:47:A4:95:D3:94:26:A8:F8:17:0A:11:82:C4:1C:ED:9A:E6:38:2E:A1:B2:AA:DA:96:9E:03:1A:6F',
            issuer: sampleSigner,
            key: 'EC P-256',
            notAfter: '2036-01-01T00:00:00Z',
            notBefore: '2026-01-01T00:00:00Z',
            selfSigned: true,
            serial: '1a2b3c',
            subject: sampleSigner,
          },
          digestAlgorithm: 'SHA-256',
          hasMessageDigest: true,
          hasSigningCertificateV2: false,
          hasTimestamp: false,
          signatureAlgorithm: 'ecdsa-with-SHA256',
          signingTime: '2026-11-25T20:40:44Z',
        },
      ],
    };

    for (const pdf of [signedDerPdf, signedBerPdf, signedEditedPdf]) {
      const { signerCertificates, ...decoded } = await decodeCmsSignedData(signatureContents(pdf));

      assert.deepEqual(decoded, expected);
      assert.ok(signerCertificates[0] instanceof Uint8Array);
    }

    assert.equal(signatureContents(signedBerPdf)[1], 0x80);
  });

  it('matches a subjectKeyIdentifier sid and reports CAdES attributes', async () => {
    const report = await decodeCmsSignedData(new Uint8Array(Buffer.from(keyIdCadesCms, 'base64')));
    const [signer] = report.signers;

    assert.deepEqual(report.certificates, ['CN=Key Id Signer']);
    assert.equal(signer?.certificate?.subject, 'CN=Key Id Signer');
    assert.equal(signer?.certificate?.serial, '0102');
    assert.equal(signer?.certificate?.key, 'RSA 2048');

    assert.equal(
      signer?.certificate?.fingerprintSha256,
      'B9:23:26:A9:2B:0D:15:E5:5C:3B:FC:BC:24:1C:E6:CF:18:D9:CB:C0:8A:68:20:87:45:3E:BD:A6:69:57:E5:F6',
    );

    assert.equal(signer?.signatureAlgorithm, 'rsaEncryption');
    assert.equal(signer?.signingTime, '2026-10-29T08:00:28Z');
    assert.equal(signer?.hasSigningCertificateV2, true);
    assert.equal(signer?.hasMessageDigest, true);
  });

  it('reports a timestamp token and an unmatched signer without a certificate', async () => {
    const oid = (...bytes: number[]): number[] => der(0x06, bytes);
    const signerInfo = der(
      0x30,
      [0x02, 0x01, 0x01],
      der(0x80, [0xaa]),
      der(0x30, oid(0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03)),
      der(0x30, oid(0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02)),
      der(0x04, []),
      der(
        0xa1,
        der(
          0x30,
          oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x0e),
          der(0x31, der(0x30, [])),
        ),
      ),
    );
    const signedData = der(
      0x30,
      [0x02, 0x01, 0x03],
      der(0x31, []),
      der(0x30, oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01)),
      der(0x31, signerInfo),
    );
    const contentInfo = der(
      0x30,
      oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02),
      der(0xa0, signedData),
    );

    assert.deepEqual(await decodeCmsSignedData(Uint8Array.from([...contentInfo, 0, 0, 0])), {
      certificates: [],
      signerCertificates: [undefined],
      signers: [
        {
          digestAlgorithm: 'SHA-512',
          hasMessageDigest: false,
          hasSigningCertificateV2: false,
          hasTimestamp: true,
          signatureAlgorithm: 'ecdsa-with-SHA256',
        },
      ],
    });
  });

  it('names newer algorithms and tolerates a bad or ancient signing time', async () => {
    const oid = (...bytes: number[]): number[] => der(0x06, bytes);
    const signingTime = (time: string) =>
      der(
        0xa0,
        der(
          0x30,
          oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x05),
          der(0x31, der(0x18, [...Buffer.from(time)])),
        ),
      );

    const decode = (digest: number[], signature: number[], time: string) => {
      const signerInfo = der(
        0x30,
        [0x02, 0x01, 0x01],
        der(0x80, [0xaa]),
        der(0x30, oid(...digest)),
        signingTime(time),
        der(0x30, oid(...signature)),
        der(0x04, []),
      );
      const signedData = der(
        0x30,
        [0x02, 0x01, 0x03],
        der(0x31, []),
        der(0x30, oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01)),
        der(0x31, signerInfo),
      );

      return decodeCmsSignedData(
        Uint8Array.from(
          der(
            0x30,
            oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02),
            der(0xa0, signedData),
          ),
        ),
      );
    };

    const sha3 = (last: number) => [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, last];
    const pss = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a];
    const ed25519 = [0x2b, 0x65, 0x70];

    const pssResult = await decode(sha3(0x08), pss, '00500101000000Z');
    const edResult = await decode(sha3(0x0a), ed25519, '20261328000000Z');

    assert.equal(pssResult.signers[0]?.digestAlgorithm, 'SHA3-256');
    assert.equal(pssResult.signers[0]?.signatureAlgorithm, 'RSASSA-PSS');
    assert.equal(pssResult.signers[0]?.signingTime, '0050-01-01T00:00:00Z');
    assert.equal(edResult.signers[0]?.digestAlgorithm, 'SHA3-512');
    assert.equal(edResult.signers[0]?.signatureAlgorithm, 'Ed25519');
    assert.equal(edResult.signers[0]?.signingTime, undefined);

    assert.equal(
      (await decode(sha3(0x07), ed25519, '20261028000000Z')).signers[0]?.digestAlgorithm,
      'SHA3-224',
    );

    assert.equal(
      (await decode(sha3(0x09), ed25519, '20261028000000Z')).signers[0]?.digestAlgorithm,
      'SHA3-384',
    );

    assert.deepEqual(
      ['1.3.36.3.3.2.8.1.1.7', '1.3.36.3.3.2.8.1.1.11', '1.3.36.3.3.2.8.1.1.13'].map(
        (curve) => ecCurveNames[curve],
      ),
      ['brainpoolP256r1', 'brainpoolP384r1', 'brainpoolP512r1'],
    );
  });

  it('rejects content that is not signedData', async () => {
    const data = der(0x30, der(0x06, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]));

    await assert.rejects(decodeCmsSignedData(Uint8Array.from(data)), {
      code: 'INVALID_CMS',
      message: 'The signature is not a CMS SignedData structure.',
    });
  });

  it('raises only FunctionError for truncated or mutated DER and BER blobs', async () => {
    let seed = 0x5eed;

    const random = (max: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;

      return seed % max;
    };

    for (const pdf of [signedDerPdf, signedBerPdf]) {
      const blob = signatureContents(pdf);
      const length = blob.reduce((end, byte, index) => (byte === 0 ? end : index + 1), 0);

      for (let round = 0; round < 300; round += 1) {
        const sample = round % 2 === 0 ? blob.slice(0, random(length)) : blob.slice(0, length + 2);

        if (round % 2 === 1) {
          for (let flip = 0; flip < 1 + random(4); flip += 1) {
            sample[random(sample.length)] = random(256);
          }
        }

        try {
          await decodeCmsSignedData(sample);
        } catch (error) {
          assert.ok(isFunctionError(error), `round ${round}: ${String(error)}`);
        }
      }
    }
  });
});

describe('OID decoding', () => {
  const decode = (...bytes: number[]): string =>
    oid(parseAsn1(Uint8Array.from([0x06, bytes.length, ...bytes])));

  it('decodes large OID arcs', () => {
    assert.equal(decode(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d), '1.2.840.113549');
    assert.equal(decode(0x88, 0x37), '2.999');

    const arc = (1n << 128n) - 1n;
    const encoded: number[] = [];

    for (let rest = arc; rest > 0n; rest >>= 7n) encoded.unshift(Number(rest & 0x7fn) | 0x80);
    encoded[encoded.length - 1]! &= 0x7f;

    assert.equal(decode(0x69, ...encoded), `2.25.${arc}`);
  });
});
