import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PDFDocument, PDFHexString, PDFName, PDFObject, PDFString } from 'pdf-lib';
import { pemEncode } from '../src/crypto';
import { inspectPdfSignatures } from '../src/pdf';
import { signedBerPdf, signedDerPdf, signedEditedPdf } from './fixtures/signedPdf';

// Mirrors pdf-lib's unexported Literal type accepted by PDFContext.obj.
type PdfLiteral =
  | PDFObject
  | PdfLiteral[]
  | boolean
  | number
  | string
  | null
  | undefined
  | { [name: string]: PdfLiteral };

const disclaimer =
  'Presence and signer only. This tool does not check whether the signature is valid.';
const file = (base64: string, name = 'signed.pdf') => ({
  bytes: new Uint8Array(Buffer.from(base64, 'base64')),
  name,
});

async function withSignatureField(
  value?: { [name: string]: PdfLiteral },
  perms = false,
  encrypted = false,
) {
  const pdf = await PDFDocument.create();
  const { context } = pdf;

  pdf.addPage();

  const signature = value ? context.register(context.obj(value)) : undefined;
  const field = context.register(
    context.obj({
      FT: 'Sig',
      Subtype: 'Widget',
      T: PDFHexString.fromText('Sig1'),
      Type: 'Annot',
      ...(signature && { V: signature }),
    }),
  );

  pdf.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: [field] }));
  if (signature && perms) pdf.catalog.set(PDFName.of('Perms'), context.obj({ DocMDP: signature }));

  if (encrypted) pdf.context.trailerInfo.Encrypt = context.register(context.obj({}));

  return { bytes: await pdf.save(), name: 'built.pdf' };
}

describe('inspectPdfSignatures', () => {
  it('reports a DER signature that covers the whole file', async () => {
    const result = await inspectPdfSignatures(file(signedDerPdf));
    const [signature] = result.signatures;

    assert.equal(result.signatures.length, 1);
    assert.equal(signature?.field, 'Signature1');
    assert.equal(signature?.reason, 'Approved');
    assert.equal(signature?.location, 'Prague');
    assert.equal(signature?.signingTime, '2026-10-28T10:00:00Z');
    assert.equal(signature?.subFilter, 'adbe.pkcs7.detached');
    assert.equal(signature?.type, 'signature');
    assert.deepEqual(signature?.byteRange, { coversWholeFile: true, wellFormed: true });
    assert.equal(signature?.cms?.signers[0]?.signingTime, '2026-11-25T20:40:44Z');
    assert.equal(signature?.cms?.signers[0]?.digestAlgorithm, 'SHA-256');

    assert.equal(
      signature?.cms?.signers[0]?.certificate?.subject,
      'CN=Sample Signer\nO=Dev Toolora\nC=CZ',
    );

    assert.ok(result.summary.endsWith(disclaimer));

    assert.ok(
      pemEncode('CERTIFICATE', result.signerCertificates[0] ?? new Uint8Array()).startsWith(
        '-----BEGIN CERTIFICATE-----\n',
      ),
    );
  });

  it('reads the BER signature the same way', async () => {
    const der = await inspectPdfSignatures(file(signedDerPdf));
    const ber = await inspectPdfSignatures(file(signedBerPdf));

    assert.deepEqual(ber.signatures, der.signatures);
    assert.ok(ber.signerCertificates[0]);
  });

  it('counts the bytes appended after the signature', async () => {
    const result = await inspectPdfSignatures(file(signedEditedPdf));

    assert.deepEqual(result.signatures[0]?.byteRange, {
      appendedBytes: 25,
      coversWholeFile: false,
      wellFormed: true,
    });

    assert.match(result.summary, /25 bytes were appended after Signature1/);
  });

  it('flags a byte range whose gap is not the contents string', async () => {
    const text = Buffer.from(signedDerPdf, 'base64').toString('latin1');
    const patched = text.replace('[0 690 3092 576]', '[0 690 3000 576]');
    const result = await inspectPdfSignatures({
      bytes: new Uint8Array(Buffer.from(patched, 'latin1')),
      name: 'patched.pdf',
    });

    assert.equal(result.signatures[0]?.byteRange.wellFormed, false);
    assert.match(result.summary, /malformed byte range/);
  });

  it('reports an empty signature field as unsigned', async () => {
    const result = await inspectPdfSignatures(await withSignatureField());

    assert.equal(result.signatures.length, 1);
    assert.equal(result.signatures[0]?.field, 'Sig1');
    assert.equal(result.signatures[0]?.signed, false);
    assert.ok(result.summary.endsWith(disclaimer));
  });

  it('reports a PDF without fields', async () => {
    const pdf = await PDFDocument.create();

    pdf.addPage();

    const result = await inspectPdfSignatures({ bytes: await pdf.save(), name: 'plain.pdf' });

    assert.deepEqual(result.signatures, []);
    assert.equal(result.summary, `No signature fields found. ${disclaimer}`);
  });

  it('keeps a bad CMS from failing the report and reads timestamps and certification', async () => {
    const result = await inspectPdfSignatures(
      await withSignatureField(
        {
          ByteRange: [0, 1, 2, 3],
          Contents: PDFHexString.of('00000000'),
          M: PDFString.of('D:20261028100000Z'),
          Reference: [{ TransformMethod: 'DocMDP', TransformParams: { P: 1 } }],
          SubFilter: 'ETSI.RFC3161',
          Type: 'DocTimeStamp',
        },
        true,
      ),
    );

    assert.equal(result.signatures[0]?.type, 'document-timestamp');
    assert.equal(result.signatures[0]?.byteRange.wellFormed, false);
    assert.ok(result.signatures[0]?.cmsError);
    assert.deepEqual(result.certification, { level: 1 });
    assert.ok(result.summary.endsWith(disclaimer));
  });

  it('reports an oversized signature as an error for that signature only', async () => {
    const result = await inspectPdfSignatures(
      await withSignatureField({
        ByteRange: [0, 1, 2, 3],
        Contents: PDFHexString.of('ab'.repeat(1024 * 1024 + 1)),
      }),
    );

    assert.match(result.signatures[0]?.cmsError ?? '', /larger than the 1 MiB/);
    assert.ok(result.summary.endsWith(disclaimer));
  });

  it('needs a gap that holds the contents string and a range inside the file', async () => {
    const patch = (from: string, to: string) => ({
      bytes: new Uint8Array(
        Buffer.from(
          Buffer.from(signedDerPdf, 'base64').toString('latin1').replace(from, to),
          'latin1',
        ),
      ),
      name: 'patched.pdf',
    });
    const misplaced = await inspectPdfSignatures(patch('[0 690 3092 576]  ', '[0 100 2502 1166] '));
    const pastEnd = await inspectPdfSignatures(patch('[0 690 3092 576]  ', '[0 690 3092 5760] '));

    assert.equal(misplaced.signatures[0]?.byteRange.wellFormed, false);
    assert.equal(pastEnd.signatures[0]?.byteRange.wellFormed, false);
  });

  it('does not decode a gap beyond the size cap', async () => {
    const text = Buffer.from(signedDerPdf, 'base64').toString('latin1');
    const patched = `${text.replace('[0 690 3092 576]  ', '[0 690 2200000 0] ')}${' '.repeat(2_300_000)}`;
    const result = await inspectPdfSignatures({
      bytes: new Uint8Array(Buffer.from(patched, 'latin1')),
      name: 'huge-gap.pdf',
    });

    assert.deepEqual(result.signatures[0]?.byteRange, {
      coversWholeFile: false,
      wellFormed: false,
    });
  });

  it('decodes contents with white space and an odd digit count', async () => {
    const text = Buffer.from(signedDerPdf, 'base64').toString('latin1');

    const decode = async (tail: string) => {
      const patched = text.replace(/(<[0-9A-Fa-f]+?)0{2}>/, `$1${tail}>`);
      const result = await inspectPdfSignatures({
        bytes: new Uint8Array(Buffer.from(patched, 'latin1')),
        name: 'p.pdf',
      });

      return result.signatures[0];
    };

    for (const tail of ['\n\n', '0\n']) {
      const signature = await decode(tail);

      assert.equal(signature?.byteRange.wellFormed, true, JSON.stringify(tail));
      assert.equal(signature?.cms?.signers.length, 1, tail);
    }
  });

  it('survives a malformed date and omits the text of an encrypted file', async () => {
    const value = {
      ByteRange: [0, 1, 2, 3],
      Contents: PDFHexString.of('00'),
      M: PDFString.of('20261028100000Z'),
      Reason: PDFString.of('Because'),
    };
    const plain = await inspectPdfSignatures(await withSignatureField(value));
    const encrypted = await inspectPdfSignatures(await withSignatureField(value, false, true));

    assert.equal(plain.signatures[0]?.signingTime, undefined);
    assert.equal(plain.signatures[0]?.reason, 'Because');
    assert.equal(encrypted.signatures[0]?.reason, undefined);
    assert.match(encrypted.summary, /The PDF is encrypted/);
  });

  it('picks the DocMDP reference and treats RFC 3161 as a timestamp', async () => {
    const result = await inspectPdfSignatures(
      await withSignatureField(
        {
          ByteRange: [0, 1, 2, 3],
          Contents: PDFHexString.of('00'),
          Reference: [
            { TransformMethod: 'FieldMDP', TransformParams: { P: 1 } },
            { TransformMethod: 'DocMDP', TransformParams: { P: 3 } },
          ],
          SubFilter: 'ETSI.RFC3161',
        },
        true,
      ),
    );

    assert.deepEqual(result.certification, { level: 3 });
    assert.equal(result.signatures[0]?.type, 'document-timestamp');
  });

  it('keeps a good signature when another one cannot be decoded', async () => {
    const hex = /\/Contents\s*<([0-9A-Fa-f]+)>/.exec(
      Buffer.from(signedDerPdf, 'base64').toString('latin1'),
    )?.[1];
    const pdf = await PDFDocument.create();
    const { context } = pdf;
    const sign = (contents: string, title: string) =>
      context.register(
        context.obj({
          FT: 'Sig',
          T: PDFHexString.fromText(title),
          V: context.obj({ ByteRange: [0, 1, 2, 3], Contents: PDFHexString.of(contents) }),
        }),
      );

    pdf.addPage();

    pdf.catalog.set(
      PDFName.of('AcroForm'),
      context.obj({ Fields: [sign(hex ?? '', 'Good'), sign('00ff00', 'Bad')] }),
    );

    const result = await inspectPdfSignatures({ bytes: await pdf.save(), name: 'two.pdf' });

    assert.equal(result.signatures[0]?.cms?.signers.length, 1);
    assert.equal(result.signatures[0]?.cmsError, undefined);
    assert.ok(result.signatures[1]?.cmsError);
    assert.match(result.summary, /1 with unreadable signature data/);
  });

  it('reads the signer of an adbe.x509.rsa_sha1 signature from /Cert', async () => {
    const [der] = (await inspectPdfSignatures(file(signedDerPdf))).signerCertificates;
    const result = await inspectPdfSignatures(
      await withSignatureField({
        ByteRange: [0, 1, 2, 3],
        Cert: PDFHexString.of(Buffer.from(der ?? []).toString('hex')),
        Contents: PDFHexString.of('00'),
        SubFilter: 'adbe.x509.rsa_sha1',
      }),
    );

    assert.equal(result.signatures[0]?.cms?.signers[0]?.certificate?.key, 'EC P-256');
    assert.equal(result.signatures[0]?.cmsError, undefined);
    assert.deepEqual(result.signerCertificates[0], der);
  });

  it('says when more fields exist than are listed', async () => {
    const pdf = await PDFDocument.create();
    const { context } = pdf;
    const fields = Array.from({ length: 201 }, (_, index) =>
      context.register(context.obj({ FT: 'Sig', T: PDFHexString.fromText(`F${index}`) })),
    );

    pdf.addPage();
    pdf.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: fields }));

    const result = await inspectPdfSignatures({ bytes: await pdf.save(), name: 'many.pdf' });

    assert.equal(result.signatures.length, 200);
    assert.match(result.summary, /only the first 200 fields are listed/);
  });

  it('never reads a signature through another signature gap', async () => {
    const hex = /\/Contents\s*<([0-9A-Fa-f]+)>/.exec(
      Buffer.from(signedDerPdf, 'base64').toString('latin1'),
    )?.[1];

    const build = async (a: number, b: number) => {
      const pdf = await PDFDocument.create();
      const { context } = pdf;
      const sign = (title: string, contents: string, range: number[]) =>
        context.register(
          context.obj({
            FT: 'Sig',
            T: PDFHexString.fromText(title),
            V: context.obj({ ByteRange: range, Contents: PDFHexString.of(contents) }),
          }),
        );

      pdf.addPage();

      pdf.catalog.set(
        PDFName.of('AcroForm'),
        context.obj({
          Fields: [sign('Sig1', hex ?? '', [0, 1, 2, 3]), sign('Sig2', '00ff00', [0, a, b, 0])],
        }),
      );

      // Object streams would compress the strings the byte range must point at.
      return pdf.save({ useObjectStreams: false });
    };

    let bytes = await build(11111, 22222);

    // Point Sig2 at Sig1's gap; offsets settle once the number widths do.
    for (let round = 0; round < 5; round += 1) {
      const text = Buffer.from(bytes).toString('latin1');
      const start = text.indexOf(`<${hex}>`);

      assert.ok(start > 0);

      bytes = await build(start, start + (hex?.length ?? 0) + 2);
    }

    const result = await inspectPdfSignatures({ bytes, name: 'foreign.pdf' });

    assert.equal(result.signatures[1]?.byteRange.wellFormed, false);
    assert.equal(result.signatures[1]?.cms, undefined);
    assert.equal(result.signerCertificates[1], undefined);
  });

  it('names fields of an encrypted file by position', async () => {
    const value = { ByteRange: [0, 1, 2, 3], Contents: PDFHexString.of('00') };
    const result = await inspectPdfSignatures(await withSignatureField(value, false, true));

    assert.equal(result.signatures[0]?.field, 'Signature 1');
  });
});
