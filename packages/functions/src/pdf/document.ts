import type { PDFDocument } from 'pdf-lib';
import { FunctionError } from '../errors';

export type PdfLib = typeof import('pdf-lib');
export type PdfFile = { bytes: Uint8Array; name: string };

let pdfLibPromise: Promise<PdfLib> | undefined;

export function loadPdfLib(): Promise<PdfLib> {
  pdfLibPromise ??= import('pdf-lib');

  return pdfLibPromise;
}

/** Loads a PDF for editing without stamping pdf-lib into Producer or the dates. */
export async function openPdf(
  file: PdfFile,
  options: { allowEncrypted?: boolean } = {},
): Promise<PDFDocument> {
  assertPdfSize(file);

  if (!startsWithPdfHeader(file.bytes))
    throw pdfError(`${file.name} is not a PDF: it does not start with %PDF-.`);

  const { PDFDocument } = await loadPdfLib();
  let pdf: PDFDocument;

  try {
    pdf = await PDFDocument.load(file.bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (error) {
    throw pdfError(
      `${file.name} could not be read as a PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (pdf.isEncrypted && !options.allowEncrypted) {
    throw pdfError(
      `${file.name} is encrypted or password protected. Remove the protection in a PDF reader (print or save as an unprotected PDF), then try again.`,
    );
  }

  try {
    // pdf-lib accepts a header followed by garbage; only the page tree proves it read a document.
    pdf.getPageCount();
  } catch {
    throw pdfError(`${file.name} could not be read as a PDF: its pages are missing or damaged.`);
  }

  return pdf;
}

export async function createPdf(): Promise<PDFDocument> {
  const { PDFDocument } = await loadPdfLib();

  return PDFDocument.create({ updateMetadata: false });
}

export function copyPdfInformation(source: PDFDocument, target: PDFDocument): void {
  const title = source.getTitle();
  const author = source.getAuthor();
  const subject = source.getSubject();
  const keywords = source.getKeywords();
  const creator = source.getCreator();
  const producer = source.getProducer();
  const created = source.getCreationDate();
  const modified = source.getModificationDate();

  if (title) target.setTitle(title);
  if (author) target.setAuthor(author);
  if (subject) target.setSubject(subject);
  if (keywords) target.setKeywords([keywords]);
  if (creator) target.setCreator(creator);
  if (producer) target.setProducer(producer);
  if (created) target.setCreationDate(created);
  if (modified) target.setModificationDate(modified);
}

export function pdfVersion(bytes: Uint8Array): string {
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));

  return header.match(/%PDF-(\d\.\d)/)?.[1] ?? 'unknown';
}

function startsWithPdfHeader(bytes: Uint8Array): boolean {
  // The header may follow up to 1024 bytes of leading junk.
  return new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-');
}

export function baseName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? name).replace(/\.(pdf|docx|xlsx)$/i, '') || 'document';
}

const pdfMaxBytes = 50 * 1024 * 1024;

export function assertPdfSize(file: PdfFile): void {
  if (file.bytes.length > pdfMaxBytes) throw pdfError('A PDF file is limited to 50 MiB.');
}

export function pdfError(message: string): FunctionError {
  return new FunctionError('INVALID_PDF', message);
}
