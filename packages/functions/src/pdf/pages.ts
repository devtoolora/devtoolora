import type { PDFDocument } from 'pdf-lib';
import {
  baseName,
  copyPdfInformation,
  createPdf,
  loadPdfLib,
  openPdf,
  pdfError,
  pdfVersion,
  type PdfFile,
} from './document';

export type PdfSplitMode = 'each' | 'every' | 'ranges';
export type PdfRotation = 90 | 180 | 270;

export type PdfMetadata = {
  author: string;
  created: string;
  creator: string;
  keywords: string;
  modified: string;
  producer: string;
  subject: string;
  title: string;
};

export type PdfInfo = {
  bytes: number;
  encrypted: boolean;
  file: string;
  formFields: number;
  /** Null for an encrypted file: pdf-lib cannot decrypt the fields, so they read as ciphertext. */
  metadata: PdfMetadata | null;
  pageCount: number;
  pageSizes: string[];
  rotatedPages: number[];
  version: string;
  xmpMetadata: boolean;
};

const selectionHelp = 'Use page numbers and ranges such as 1-3, 5, 8-, last, odd or even.';

export const pdfPaperSizes: ReadonlyArray<readonly [name: string, width: number, height: number]> =
  [
    ['A3', 841.89, 1190.55],
    ['A4', 595.28, 841.89],
    ['A5', 419.53, 595.28],
    ['Letter', 612, 792],
    ['Legal', 612, 1008],
    ['Tabloid', 792, 1224],
  ];

export function parsePageSelection(
  value: string,
  pageCount: number,
  options: { ordered?: boolean } = {},
): number[] {
  const source = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-');

  if (!source) throw pdfError(`Enter the pages. ${selectionHelp}`);

  const pages: number[] = [];

  const page = (text: string, part: string): number => {
    if (text === 'last' || text === 'end') return pageCount;
    if (!/^\d+$/.test(text)) throw pdfError(`"${part}" is not a page selection. ${selectionHelp}`);

    const number = Number(text);

    if (number < 1) throw pdfError('Pages are numbered from 1.');
    if (number > pageCount)
      throw pdfError(
        `Page ${number} does not exist; this PDF has ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}.`,
      );

    return number;
  };

  for (const raw of source.split(/[,;]|\s+(?=\d|last|odd|even|all)/)) {
    const part = raw.trim();

    if (!part) continue;
    if (part === 'all') pages.push(...range(1, pageCount));
    else if (part === 'odd' || part === 'even')
      pages.push(
        ...range(1, pageCount).filter((number) => number % 2 === (part === 'odd' ? 1 : 0)),
      );
    else if (part.includes('-')) {
      const [startText, endText, extra] = part.split('-').map((text) => text.trim());

      if (extra !== undefined) throw pdfError(`"${part}" has more than one dash. ${selectionHelp}`);

      const start = startText ? page(startText, part) : 1;
      const end = endText ? page(endText, part) : pageCount;

      if (start > end && !options.ordered)
        throw pdfError(`"${part}" runs backwards; write ${end}-${start}.`);

      pages.push(...(start <= end ? range(start, end) : range(end, start).reverse()));
    } else pages.push(page(part, part));
  }

  if (!pages.length) throw pdfError(`Enter the pages. ${selectionHelp}`);

  return options.ordered ? pages : [...new Set(pages)].sort((a, b) => a - b);
}

export function formatPageSelection(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index]!;

    while (sorted[index + 1] === sorted[index]! + 1) index += 1;
    parts.push(start === sorted[index] ? String(start) : `${start}-${sorted[index]}`);
  }

  return parts.join(', ');
}

export function formatPageOrder(pages: number[]): string {
  const parts: string[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const start = pages[index]!;

    while (pages[index + 1] === pages[index]! + 1) index += 1;
    parts.push(start === pages[index] ? String(start) : `${start}-${pages[index]}`);
  }

  return parts.join(', ');
}

export async function inspectPdf(file: PdfFile): Promise<PdfInfo> {
  const pdf = await openPdf(file, { allowEncrypted: true });
  const { PDFName } = await loadPdfLib();
  const sizes = new Map<string, number>();
  const rotatedPages: number[] = [];

  pdf.getPages().forEach((page, index) => {
    const { height, width } = page.getSize();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;

    if (rotation) rotatedPages.push(index + 1);

    const label = pageSizeLabel(rotation % 180 ? height : width, rotation % 180 ? width : height);

    sizes.set(label, (sizes.get(label) ?? 0) + 1);
  });

  let formFields = 0;

  try {
    formFields = pdf.getForm().getFields().length;
  } catch {
    /* forms in encrypted or broken files cannot be read */
  }

  return {
    bytes: file.bytes.length,
    encrypted: pdf.isEncrypted,
    file: file.name,
    formFields,
    metadata: pdf.isEncrypted ? null : readMetadata(pdf),
    pageCount: pdf.getPageCount(),
    pageSizes: [...sizes].map(([label, count]) =>
      sizes.size === 1 ? label : `${label} × ${count}`,
    ),
    rotatedPages,
    version: pdfVersion(file.bytes),
    xmpMetadata: pdf.catalog.has(PDFName.of('Metadata')),
  };
}

export function readMetadata(pdf: PDFDocument): PdfMetadata {
  const date = (value: Date | undefined) =>
    value && !Number.isNaN(value.getTime()) ? value.toISOString() : '';

  return {
    author: pdf.getAuthor() ?? '',
    created: date(pdf.getCreationDate()),
    creator: pdf.getCreator() ?? '',
    keywords: pdf.getKeywords() ?? '',
    modified: date(pdf.getModificationDate()),
    producer: pdf.getProducer() ?? '',
    subject: pdf.getSubject() ?? '',
    title: pdf.getTitle() ?? '',
  };
}

export async function mergePdfs(files: PdfFile[]): Promise<Uint8Array> {
  if (!files.length) throw pdfError('Add at least one PDF file.');

  const output = await createPdf();

  for (const [index, file] of files.entries()) {
    const source = await openPdf(file);

    if (index === 0) copyPdfInformation(source, output);

    for (const page of await output.copyPages(source, source.getPageIndices()))
      output.addPage(page);
  }

  return output.save();
}

export async function extractPdfPages(
  file: PdfFile,
  selection: string,
): Promise<{ bytes: Uint8Array; pages: number[] }> {
  const source = await openPdf(file);
  const pages = parsePageSelection(selection, source.getPageCount());

  return { bytes: await copyPages(source, pages), pages };
}

export async function deletePdfPages(
  file: PdfFile,
  selection: string,
): Promise<{ bytes: Uint8Array; pages: number[] }> {
  const source = await openPdf(file);
  const remove = new Set(parsePageSelection(selection, source.getPageCount()));
  const keep = range(1, source.getPageCount()).filter((page) => !remove.has(page));

  if (!keep.length) throw pdfError('That would delete every page; a PDF needs at least one.');

  return { bytes: await copyPages(source, keep), pages: [...remove] };
}

export async function reorderPdf(
  file: PdfFile,
  order: string,
): Promise<{ bytes: Uint8Array; omitted: number[]; pages: number[] }> {
  const source = await openPdf(file);
  const pages = parsePageSelection(order, source.getPageCount(), { ordered: true });
  const listed = new Set(pages);

  return {
    bytes: await copyPages(source, pages),
    omitted: range(1, source.getPageCount()).filter((page) => !listed.has(page)),
    pages,
  };
}

export async function rotatePdfPages(
  file: PdfFile,
  selection: string,
  angle: PdfRotation,
): Promise<{ bytes: Uint8Array; pages: number[] }> {
  if (angle !== 90 && angle !== 180 && angle !== 270)
    throw pdfError('Rotate by 90, 180 or 270 degrees.');

  const { degrees } = await loadPdfLib();
  const pdf = await openPdf(file);
  const pages = parsePageSelection(selection || 'all', pdf.getPageCount());

  for (const number of pages) {
    const page = pdf.getPage(number - 1);

    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  }

  return { bytes: await pdf.save(), pages };
}

export async function splitPdf(
  file: PdfFile,
  mode: PdfSplitMode = 'each',
  value = '',
): Promise<PdfFile[]> {
  const source = await openPdf(file);
  const count = source.getPageCount();
  const name = baseName(file.name);
  const groups = splitPdfGroups(mode, value, count);

  if (groups.length > 500)
    throw pdfError(`That would create ${groups.length} files; split into at most 500.`);

  const files: PdfFile[] = [];
  const labels = new Map<string, number>();

  for (const group of groups) {
    const label = group.length === 1 ? `p${group[0]}` : `p${group[0]}-${group[group.length - 1]}`;
    const uses = (labels.get(label) ?? 0) + 1;

    labels.set(label, uses);
    // A repeated range would overwrite the earlier entry in the ZIP.
    const suffix = uses > 1 ? `-copy${uses}` : '';

    files.push({ bytes: await copyPages(source, group), name: `${name}-${label}${suffix}.pdf` });
  }

  return files;
}

export function splitPdfGroups(mode: PdfSplitMode, value: string, pageCount: number): number[][] {
  if (mode === 'each') return range(1, pageCount).map((page) => [page]);

  if (mode === 'every') {
    const size = Number(value);

    if (!Number.isInteger(size) || size < 1)
      throw pdfError('Pages per file must be a whole number of at least 1.');

    const groups: number[][] = [];

    for (let start = 1; start <= pageCount; start += size)
      groups.push(range(start, Math.min(pageCount, start + size - 1)));

    return groups;
  }

  if (mode === 'ranges') {
    const groups = value
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => parsePageSelection(part, pageCount, { ordered: true }));

    if (!groups.length) throw pdfError('Enter one range per output file, such as 1-3, 4-6, 7-.');

    return groups;
  }

  throw pdfError('Choose each page, every N pages or custom ranges.');
}

export async function compactPdf(file: PdfFile): Promise<Uint8Array> {
  const pdf = await openPdf(file);

  return pdf.save({ useObjectStreams: true });
}

export function pageSizeLabel(width: number, height: number): string {
  const portrait = height >= width;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const name = pdfPaperSizes.find(
    ([, a, b]) => Math.abs(a - short) < 2 && Math.abs(b - long) < 2,
  )?.[0];
  const millimetres = `${Math.round((width * 25.4) / 72)} × ${Math.round((height * 25.4) / 72)} mm`;

  if (Math.abs(width - height) < 1) return `${name ?? 'Square'} (${millimetres})`;

  return `${name ?? 'Custom'} ${portrait ? 'portrait' : 'landscape'} (${millimetres})`;
}

async function copyPages(source: PDFDocument, pages: number[]): Promise<Uint8Array> {
  const output = await createPdf();

  copyPdfInformation(source, output);
  for (const page of await output.copyPages(
    source,
    pages.map((number) => number - 1),
  ))
    output.addPage(page);

  return output.save({ useObjectStreams: true });
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}
