import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import { FunctionError } from '../errors';
import { assertPdfSize, pdfError, type PdfFile } from './document';
import { parsePageSelection } from './pages';
import { importPdfjs, type PdfJs } from './pdfjs';

type PdfTextResult = {
  emptyPages: number;
  pageCount: number;
  pages: Array<{ page: number; text: string }>;
  text: string;
};

const maxPages = 2000;
const defaultMaxTextLength = 20_000_000;

let pdfjsPromise: Promise<PdfJs> | undefined;

export function loadPdfjs(load: () => Promise<PdfJs> = importPdfjs): Promise<PdfJs> {
  pdfjsPromise ??= load().catch((error: unknown) => {
    // A failed chunk load must not stick; the next run retries.
    pdfjsPromise = undefined;

    throw error;
  });

  return pdfjsPromise;
}

export function pdfjsError(error: unknown): FunctionError {
  if (error instanceof FunctionError) return error;

  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : '';

  return pdfError(
    name === 'PasswordException'
      ? 'This PDF is password protected. Remove the password first.'
      : 'This file could not be read as a PDF.',
  );
}

export function selectTextPages(selection: string, pageCount: number): number[] {
  const pages = parsePageSelection(selection.trim() || 'all', pageCount);

  if (pages.length > maxPages)
    throw pdfError(
      `Text can be extracted from at most 2,000 pages at once; ${pages.length.toLocaleString('en-US')} are selected. Choose fewer pages.`,
    );

  return pages;
}

export function pageText(items: Array<TextItem | TextMarkedContent>): string {
  // Per-line trimEnd: a regex like /[^\S\n]+$/gm backtracks quadratically on long space runs.
  return items
    .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
    .join('')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function joinPages(pages: PdfTextResult['pages'], pageMarkers: boolean): string {
  const blocks = pageMarkers
    ? pages.map(({ page, text }) => `--- Page ${page} ---${text ? `\n${text}` : ''}`)
    : pages.map(({ text }) => text).filter(Boolean);

  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

export async function extractPdfText(
  file: PdfFile,
  options: { maxTextLength?: number; pageMarkers: boolean; pages: string },
): Promise<PdfTextResult> {
  assertPdfSize(file);

  let getDocument: PdfJs['getDocument'];

  try {
    ({ getDocument } = await loadPdfjs());
  } catch {
    throw pdfError('The PDF reader could not be loaded. Check your connection and try again.');
  }

  // pdfjs detaches the buffer it is given, so it gets a copy.
  const task = getDocument({
    data: file.bytes.slice(),
    disableFontFace: true,
    stopAtErrors: false,
    useSystemFonts: false,
    verbosity: 0,
  });

  try {
    const pdf = await task.promise;
    const pages: PdfTextResult['pages'] = [];
    const limit = options.maxTextLength ?? defaultMaxTextLength;
    let length = 0;

    for (const page of selectTextPages(options.pages, pdf.numPages)) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const text = pageText(content.items);

      // The 20 covers the page marker and the blank line between pages.
      length += text.length + 20;

      if (length > limit)
        throw new FunctionError(
          'PDF_TEXT_LIMIT',
          `The extracted text is longer than the ${limit.toLocaleString('en-US')} character limit.`,
        );

      pages.push({ page, text });
    }

    return {
      emptyPages: pages.filter(({ text }) => !text).length,
      pageCount: pdf.numPages,
      pages,
      text: joinPages(pages, options.pageMarkers),
    };
  } catch (error) {
    throw pdfjsError(error);
  } finally {
    await task.destroy();
  }
}
