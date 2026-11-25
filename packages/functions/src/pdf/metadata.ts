import type { PDFDict, PDFDocument } from 'pdf-lib';
import { loadPdfLib, openPdf, pdfError, type PdfFile } from './document';
import { readMetadata, type PdfMetadata } from './pages';

export type PdfMetadataEdit = Partial<
  Pick<PdfMetadata, 'author' | 'creator' | 'keywords' | 'producer' | 'subject' | 'title'>
>;
export type PdfMetadataResult = {
  after: PdfMetadata;
  before: PdfMetadata;
  bytes: Uint8Array;
  notes: string[];
};

const infoKeys = {
  author: 'Author',
  created: 'CreationDate',
  creator: 'Creator',
  keywords: 'Keywords',
  modified: 'ModDate',
  producer: 'Producer',
  subject: 'Subject',
  title: 'Title',
} as const;
const editableKeys = ['title', 'author', 'subject', 'keywords', 'creator', 'producer'] as const;

/**
 * Writes the document information fields. Blank fields keep their value unless clearBlank is set.
 * The XMP stream is removed when present, because readers prefer it over the edited fields.
 */
export async function editPdfMetadata(
  file: PdfFile,
  edit: PdfMetadataEdit,
  options: { clearBlank?: boolean } = {},
): Promise<PdfMetadataResult> {
  const pdf = await openPdf(file);
  const { PDFName } = await loadPdfLib();
  const before = readMetadata(pdf);
  const info = infoDictionary(pdf);
  let changed = 0;

  for (const key of editableKeys) {
    const value = (edit[key] ?? '').trim();

    if (/[\u0000-\u001f\u007f]/.test(value))
      throw pdfError(`${infoKeys[key]} cannot contain line breaks or control characters.`);
    if (value.length > 2000) throw pdfError(`${infoKeys[key]} is limited to 2,000 characters.`);

    if (value) {
      if (key === 'title') pdf.setTitle(value, { showInWindowTitleBar: true });
      else if (key === 'keywords') pdf.setKeywords([value]);
      else if (key === 'author') pdf.setAuthor(value);
      else if (key === 'subject') pdf.setSubject(value);
      else if (key === 'creator') pdf.setCreator(value);
      else pdf.setProducer(value);

      changed += 1;
    } else if (options.clearBlank && before[key]) {
      info.delete(PDFName.of(infoKeys[key]));
      changed += 1;
    }
  }

  if (!changed)
    throw pdfError('Nothing to change: enter at least one value, or choose to clear blank fields.');

  const notes = (await removeXmpStreams(pdf))
    ? [
        'Removed the XMP metadata stream, which readers such as Acrobat prefer over the edited fields.',
      ]
    : [];

  return { after: readMetadata(pdf), before, bytes: await pdf.save(), notes };
}

export async function removePdfMetadata(file: PdfFile): Promise<PdfMetadataResult> {
  const pdf = await openPdf(file);
  const { PDFName } = await loadPdfLib();
  const before = readMetadata(pdf);
  const info = infoDictionary(pdf);

  for (const key of Object.values(infoKeys)) info.delete(PDFName.of(key));
  const notes = ['Removed every document information field.'];

  if (await removeXmpStreams(pdf)) notes.push('Removed the XMP metadata stream.');

  notes.push(
    'Page content, form values, annotations and embedded images can still contain names or other details.',
  );

  return { after: readMetadata(pdf), before, bytes: await pdf.save(), notes };
}

/**
 * Deletes the stream objects, not just the catalog link: pdf-lib saves every indirect object, so an
 * unlinked packet would stay readable in the file.
 */
async function removeXmpStreams(pdf: PDFDocument): Promise<boolean> {
  const { PDFName, PDFRef, PDFStream } = await loadPdfLib();
  const linked = pdf.catalog.get(PDFName.of('Metadata'));
  let removed = pdf.catalog.delete(PDFName.of('Metadata'));

  if (linked instanceof PDFRef) pdf.context.delete(linked);

  for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
    if (
      object instanceof PDFStream &&
      object.dict.get(PDFName.of('Type')) === PDFName.of('Metadata')
    )
      removed = pdf.context.delete(ref) || removed;
  }

  return removed;
}

function infoDictionary(pdf: PDFDocument): PDFDict {
  // pdf-lib keeps getInfoDict private; it creates the dictionary when the file has none.
  return (pdf as unknown as { getInfoDict(): PDFDict }).getInfoDict();
}
