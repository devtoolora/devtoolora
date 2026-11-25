import { FunctionError } from '../errors';
import { compareTextLines, type TextDiffResult } from '../text/diff';
import type { PdfFile } from './document';
import { extractPdfText } from './text';

type PdfSide = { name: string; pages: number[]; pageStarts: Array<{ line: number; page: number }> };
export type PdfComparison = TextDiffResult & { after: PdfSide; before: PdfSide; changed: number };
type Options = { ignoreCase: boolean; ignoreWhitespace: boolean; pages: string };

const maxLines = 10_000;
const maxTextLength = 100_000;

async function readSide(file: PdfFile, pages: string): Promise<{ side: PdfSide; text: string }> {
  const { name } = file;
  let result: Awaited<ReturnType<typeof extractPdfText>>;

  try {
    result = await extractPdfText(file, { maxTextLength, pageMarkers: false, pages });
  } catch (error) {
    if (!(error instanceof FunctionError)) throw error;
    if (error.code === 'PDF_TEXT_LIMIT')
      throw new FunctionError(
        error.code,
        `${name} has more than 100,000 characters of text; select fewer pages to compare.`,
      );

    throw new FunctionError(error.code, `${name}: ${error.message}`);
  }

  if (result.pages.every(({ text }) => !text))
    throw new FunctionError(
      'PDF_NO_TEXT',
      `${name} has no text layer; scanned pages need OCR, which this tool does not do.`,
    );

  const pageStarts: PdfSide['pageStarts'] = [];
  let line = 1;

  for (const { page, text } of result.pages) {
    pageStarts.push({ line, page });
    line += text.split('\n').length;
  }

  if (line - 1 > maxLines)
    throw new FunctionError(
      'PDF_TEXT_LINES',
      `${name} has more than 10,000 lines of text; select fewer pages to compare.`,
    );

  return {
    side: { name, pageStarts, pages: result.pages.map(({ page }) => page) },
    text: result.pages.map(({ text }) => `${text}\n`).join(''),
  };
}

export async function comparePdfs(
  before: PdfFile,
  after: PdfFile,
  options: Options,
): Promise<PdfComparison> {
  const left = await readSide(before, options.pages);
  const right = await readSide(after, options.pages);
  const result = compareTextLines(left.text, right.text, {
    ignoreCase: options.ignoreCase,
    ignoreLineEndings: false,
    ignoreWhitespace: options.ignoreWhitespace,
  });

  return {
    ...result,
    after: right.side,
    before: left.side,
    changed: result.rows.filter(({ kind }) => kind === 'changed').length,
  };
}
