import type { PDFDict } from 'pdf-lib';
import { certificateSummary, decodeCmsSignedData, type CmsSigner } from '../crypto/cms';
import { parseCertificate } from '../crypto/pemCertificate';
import { FunctionError } from '../errors';
import { loadPdfLib, openPdf, type PdfFile, type PdfLib } from './document';

const MAX_DEPTH = 32;
const MAX_SIGNATURES = 200;
const MAX_CMS_BYTES = 1024 * 1024;
const DISCLAIMER =
  'Presence and signer only. This tool does not check whether the signature is valid.';

export type PdfSignatureReport = {
  byteRange: { appendedBytes?: number; coversWholeFile: boolean; wellFormed: boolean };
  cms?: { certificates: string[]; signers: CmsSigner[] };
  cmsError?: string;
  contactInfo?: string;
  field: string;
  location?: string;
  name?: string;
  reason?: string;
  signed: boolean;
  signingTime?: string;
  subFilter?: string;
  type: 'document-timestamp' | 'signature';
};

export type PdfSignatureInspection = {
  certification?: { level: 1 | 2 | 3 };
  signatures: PdfSignatureReport[];
  signerCertificates: Array<Uint8Array | undefined>;
  summary: string;
};

type FieldEntry = { dict: PDFDict; name: string };

/** Lists signature fields and what their signatures claim; nothing is cryptographically checked. */
export async function inspectPdfSignatures(file: PdfFile): Promise<PdfSignatureInspection> {
  const pdf = await openPdf(file, { allowEncrypted: true });
  const lib = await loadPdfLib();
  const { PDFDict, PDFName } = lib;
  const form = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const found = collectFields(lib, form);
  const docMdp = pdf.catalog
    .lookupMaybe(PDFName.of('Perms'), PDFDict)
    ?.lookupMaybe(PDFName.of('DocMDP'), PDFDict);
  const signatures: PdfSignatureReport[] = [];
  const signerCertificates: Array<Uint8Array | undefined> = [];
  let certification: PdfSignatureInspection['certification'];

  for (const [index, { dict: field, name }] of found.fields.entries()) {
    const value = field.lookup(PDFName.of('V'));
    const dict = value instanceof PDFDict ? value : undefined;
    const { certificate, report } = await inspectField(
      lib,
      file.bytes,
      // The /T names are encrypted too.
      pdf.isEncrypted ? `Signature ${index + 1}` : name,
      dict,
      pdf.isEncrypted,
    );

    signatures.push(report);
    signerCertificates.push(certificate);

    if (dict && dict === docMdp) certification = { level: certificationLevel(lib, dict) };
  }

  return {
    ...(certification && { certification }),
    signatures,
    signerCertificates,
    summary: summarize(signatures, certification, found.truncated, pdf.isEncrypted),
  };
}

function summarize(
  signatures: PdfSignatureReport[],
  certification: PdfSignatureInspection['certification'],
  truncated: boolean,
  encrypted: boolean,
): string {
  if (!signatures.length) return `No signature fields found. ${DISCLAIMER}`;

  const count = (predicate: (report: PdfSignatureReport) => boolean) =>
    signatures.filter(predicate).length;
  const timestamps = count((r) => r.type === 'document-timestamp');
  const errors = count((r) => Boolean(r.cmsError));
  const parts = [
    `${signatures.length} signature ${signatures.length === 1 ? 'field' : 'fields'}`,
    `${count((r) => r.signed && r.type === 'signature')} signed`,
    `${count((r) => !r.signed)} unsigned`,
    ...(timestamps ? [`${timestamps} document timestamp`] : []),
    ...(certification ? [`certification level ${certification.level}`] : []),
    ...(errors ? [`${errors} with unreadable signature data`] : []),
    ...(truncated ? [`only the first ${MAX_SIGNATURES} fields are listed`] : []),
    ...signatures
      .filter((r) => r.signed && r.byteRange.appendedBytes)
      .map((r) => `${r.byteRange.appendedBytes} bytes were appended after ${r.field}`),
    ...signatures
      .filter((r) => r.signed && !r.byteRange.wellFormed)
      .map((r) => `${r.field} has a malformed byte range`),
  ];
  const note = encrypted
    ? ' The PDF is encrypted, so the name, reason, location, contact and date text is omitted.'
    : '';

  return `${parts.join(' · ')}.${note} ${DISCLAIMER}`;
}

function collectFields(
  lib: PdfLib,
  form: PDFDict | undefined,
): { fields: FieldEntry[]; truncated: boolean } {
  const fields: FieldEntry[] = [];
  const seen = new Set<PDFDict>();
  let truncated = false;

  const visit = (dict: PDFDict, parentName: string, inherited: string, depth: number): void => {
    if (seen.has(dict) || depth > MAX_DEPTH) return;

    seen.add(dict);

    const title = text(lib, dict, 'T');
    const name = [parentName, title].filter(Boolean).join('.');
    const type = dict.lookup(lib.PDFName.of('FT'))?.toString() ?? inherited;
    const kids = dict.lookup(lib.PDFName.of('Kids'));
    const children =
      kids instanceof lib.PDFArray
        ? kids
            .asArray()
            .map((kid) => (kid instanceof lib.PDFRef ? dict.context.lookup(kid) : kid))
            .filter((kid): kid is PDFDict => kid instanceof lib.PDFDict)
        : [];
    const subFields = children.filter((kid) => text(lib, kid, 'T') !== undefined);

    if (subFields.length) {
      for (const kid of subFields) visit(kid, name, type, depth + 1);
    } else if (type === '/Sig') {
      if (fields.length >= MAX_SIGNATURES) truncated = true;
      else fields.push({ dict, name });
    }
  };

  const roots = form?.lookup(lib.PDFName.of('Fields'));

  if (roots instanceof lib.PDFArray) {
    for (const root of roots.asArray()) {
      const dict = root instanceof lib.PDFRef ? form?.context.lookup(root) : root;

      if (dict instanceof lib.PDFDict) visit(dict, '', '', 0);
    }
  }

  return { fields, truncated };
}

function text(lib: PdfLib, dict: PDFDict, key: string): string | undefined {
  const value = dict.lookup(lib.PDFName.of(key));

  try {
    return value instanceof lib.PDFString || value instanceof lib.PDFHexString
      ? value.decodeText()
      : undefined;
  } catch {
    return undefined;
  }
}

function certificationLevel(lib: PdfLib, signature: PDFDict): 1 | 2 | 3 {
  const references = signature.lookup(lib.PDFName.of('Reference'));
  const entries = references instanceof lib.PDFArray ? references.asArray() : [];
  const docMdp = entries
    .map((entry) => (entry instanceof lib.PDFRef ? signature.context.lookup(entry) : entry))
    .find(
      (entry): entry is PDFDict =>
        entry instanceof lib.PDFDict &&
        entry.lookup(lib.PDFName.of('TransformMethod'))?.toString() === '/DocMDP',
    );
  const level = docMdp
    ?.lookupMaybe(lib.PDFName.of('TransformParams'), lib.PDFDict)
    ?.lookup(lib.PDFName.of('P'));
  const number = level instanceof lib.PDFNumber ? level.asNumber() : 2;

  return number === 1 || number === 3 ? number : 2;
}

async function inspectField(
  lib: PdfLib,
  fileBytes: Uint8Array,
  field: string,
  dict: PDFDict | undefined,
  encrypted: boolean,
): Promise<{ certificate?: Uint8Array; report: PdfSignatureReport }> {
  if (!dict) {
    return {
      report: {
        byteRange: { coversWholeFile: false, wellFormed: false },
        field,
        signed: false,
        type: 'signature',
      },
    };
  }

  const contents = dict.lookup(lib.PDFName.of('Contents'));
  const stored =
    contents instanceof lib.PDFHexString ? contents.asString().replace(PDF_WHITESPACE, '') : '';
  const located = locateByteRange(lib, dict, fileBytes);
  // The gap must hold this signature's own /Contents string.
  const matches =
    located.digits !== undefined && located.digits.toLowerCase() === stored.toLowerCase();
  const byteRange = matches ? located.byteRange : { coversWholeFile: false, wellFormed: false };
  // Only this signature's own /Contents is decoded, whatever the byte range points at.
  const bytes = contents instanceof lib.PDFString ? contents.asBytes() : boundedHexBytes(stored);
  const subFilter = dict.lookup(lib.PDFName.of('SubFilter'))?.toString().slice(1);

  const optional = (key: string, name: string) => {
    const value = encrypted ? undefined : text(lib, dict, key);

    return value === undefined ? {} : { [name]: value };
  };

  const signingTime = encrypted ? undefined : signedDate(lib, dict);
  const decoded = await decodeContents(lib, dict, bytes, subFilter);
  const timestamp =
    dict.lookup(lib.PDFName.of('Type'))?.toString() === '/DocTimeStamp' ||
    subFilter === 'ETSI.RFC3161';

  return {
    certificate: decoded.certificate,
    report: {
      byteRange,
      ...(decoded.cms && { cms: decoded.cms }),
      ...(decoded.error && { cmsError: decoded.error }),
      ...optional('ContactInfo', 'contactInfo'),
      field,
      ...optional('Location', 'location'),
      ...optional('Name', 'name'),
      ...optional('Reason', 'reason'),
      signed: true,
      ...(signingTime && { signingTime }),
      ...(subFilter && { subFilter }),
      type: timestamp ? 'document-timestamp' : 'signature',
    },
  };
}

function signedDate(lib: PdfLib, dict: PDFDict): string | undefined {
  const value = dict.lookup(lib.PDFName.of('M'));

  if (!(value instanceof lib.PDFString || value instanceof lib.PDFHexString)) return undefined;

  try {
    return value.decodeDate().toISOString().replace('.000Z', 'Z');
  } catch {
    return undefined;
  }
}

const PDF_WHITESPACE = /[\0\t\n\f\r ]/g;

function locateByteRange(
  lib: PdfLib,
  dict: PDFDict,
  fileBytes: Uint8Array,
): { byteRange: PdfSignatureReport['byteRange']; digits?: string } {
  const array = dict.lookup(lib.PDFName.of('ByteRange'));
  const numbers =
    array instanceof lib.PDFArray
      ? array.asArray().map((item) => (item instanceof lib.PDFNumber ? item.asNumber() : -1))
      : [];
  const [first = -1, a = -1, b = -1, c = -1] = numbers;
  const ordered =
    numbers.length === 4 &&
    numbers.every((value) => Number.isInteger(value) && value >= 0) &&
    first === 0 &&
    a < b &&
    b + c <= fileBytes.length;
  const gap =
    ordered && b - a <= 2 * MAX_CMS_BYTES + 2
      ? new TextDecoder('latin1').decode(fileBytes.subarray(a, b))
      : '';
  const hexText = /^<([0-9A-Fa-f\0\t\n\f\r ]*)>$/.exec(gap)?.[1];

  if (hexText === undefined) return { byteRange: { coversWholeFile: false, wellFormed: false } };

  const appended = fileBytes.length - (b + c);
  const digits = hexText.replace(PDF_WHITESPACE, '');

  return {
    byteRange: {
      ...(appended > 0 && { appendedBytes: appended }),
      coversWholeFile: appended === 0,
      wellFormed: true,
    },
    digits,
  };
}

function boundedHexBytes(digits: string): Uint8Array {
  return digits.replace(/(?<!0)0+$/, '').length > 2 * MAX_CMS_BYTES
    ? new Uint8Array(MAX_CMS_BYTES + 1).fill(1)
    : hexBytes(digits);
}

/** An odd final digit stands for a digit followed by 0, as in PDF hex strings. */
function hexBytes(digits: string): Uint8Array {
  return Uint8Array.from((digits.length % 2 ? `${digits}0` : digits).match(/../g) ?? [], (pair) =>
    parseInt(pair, 16),
  );
}

async function decodeContents(
  lib: PdfLib,
  dict: PDFDict,
  bytes: Uint8Array,
  subFilter: string | undefined,
): Promise<{ certificate?: Uint8Array; cms?: PdfSignatureReport['cms']; error?: string }> {
  try {
    if (subFilter === 'adbe.x509.rsa_sha1') return await decodeRsaSha1(lib, dict);

    // Padding is only measured; BER ends in zero bytes the parser needs.
    let end = bytes.length;

    while (end > 0 && bytes[end - 1] === 0) end -= 1;

    if (end > MAX_CMS_BYTES) {
      throw new FunctionError(
        'PDF_SIGNATURE_TOO_LARGE',
        'The signature data is larger than the 1 MiB this tool decodes.',
      );
    }

    const { certificates, signerCertificates, signers } = await decodeCmsSignedData(bytes);

    return { certificate: signerCertificates[0], cms: { certificates, signers } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function decodeRsaSha1(
  lib: PdfLib,
  dict: PDFDict,
): Promise<{ certificate?: Uint8Array; cms?: PdfSignatureReport['cms'] }> {
  const cert = dict.lookup(lib.PDFName.of('Cert'));
  const first = cert instanceof lib.PDFArray ? cert.lookup(0) : cert;

  if (!(first instanceof lib.PDFString || first instanceof lib.PDFHexString))
    return { cms: { certificates: [], signers: [] } };

  const der = first.asBytes();
  const parsed = parseCertificate(der);
  const signer: CmsSigner = {
    certificate: await certificateSummary(parsed),
    digestAlgorithm: 'SHA-1',
    hasMessageDigest: false,
    hasSigningCertificateV2: false,
    hasTimestamp: false,
    signatureAlgorithm: 'RSA',
  };

  return { certificate: der, cms: { certificates: [parsed.subject], signers: [signer] } };
}
