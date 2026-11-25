import { type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import { FunctionError } from '../errors';
import { base64Decode } from '../binary';
import { codePointLabel, splitFontRuns } from './fontRuns';

export interface MarkdownPdfOptions {
  fontSize?: number;
  pageSize?: 'a4' | 'letter';
}

interface FontEntry {
  bold: boolean;
  characters: Set<number>;
  font: PDFFont;
}

type TextRun = { font: PDFFont; text: string };

function validatedLayout(
  markdown: string,
  title: string,
  options: MarkdownPdfOptions,
): { bodySize: number; pageSize: 'a4' | 'letter' } {
  if (!markdown.trim()) throw invalid('Markdown input is required.');
  if (markdown.length > 50_000) throw invalid('Markdown is limited to 50,000 characters.');
  if (title.length > 200 || /[\u0000-\u001f]/.test(title))
    throw invalid('Document title must be at most 200 characters without control characters.');

  const pageSize = options.pageSize ?? 'letter';

  if (pageSize !== 'a4' && pageSize !== 'letter') throw invalid('Choose A4 or Letter page size.');

  const bodySize = options.fontSize ?? 11;

  if (!Number.isInteger(bodySize) || bodySize < 9 || bodySize > 16)
    throw invalid('Body font size must be an integer from 9 through 16.');

  return { bodySize, pageSize };
}

function fontRuns(fonts: FontEntry[], text: string, bold: boolean): TextRun[] {
  return splitFontRuns(
    text,
    fonts.filter((candidate) => candidate.bold === bold),
    (_character, code) =>
      invalid(
        `Unsupported character ${codePointLabel(code)}. Bundled fonts cover Latin and Latin Extended, not all writing systems or emoji.`,
      ),
  );
}

function textWidth(fonts: FontEntry[], text: string, size: number, bold: boolean): number {
  return fontRuns(fonts, text, bold).reduce(
    (total, run) => total + run.font.widthOfTextAtSize(run.text, size),
    0,
  );
}

function wrapToWidth(
  fonts: FontEntry[],
  text: string,
  maxWidth: number,
  size: number,
  bold: boolean,
): string[] {
  const width = (value: string): number => textWidth(fonts, value, size, bold);
  const lines: string[] = [];
  let line = '';

  for (const token of text.match(/\s+|\S+/gu) ?? []) {
    if (width(line + token) <= maxWidth) {
      line += token;

      continue;
    }

    if (line.trimEnd()) {
      lines.push(line.trimEnd());
      line = '';
    }

    const characters = Array.from(token.trimStart());

    while (characters.length) {
      let low = 1;
      let high = characters.length;
      let count = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);

        if (width(characters.slice(0, mid).join('')) <= maxWidth) {
          count = mid;
          low = mid + 1;
        } else high = mid - 1;
      }

      if (!count) throw invalid('A character is wider than the available page area.');

      const chunk = characters.splice(0, count).join('');

      if (characters.length) lines.push(chunk);
      else line = chunk;
    }
  }

  if (line.trimEnd()) lines.push(line.trimEnd());

  return lines;
}

type PdfLib = typeof import('pdf-lib');

interface PdfWriter {
  dimensions: [number, number];
  fence: string | undefined;
  fonts: FontEntry[];
  margin: number;
  page: PDFPage;
  pdf: PDFDocument;
  rgb: PdfLib['rgb'];
  wasBlank: boolean;
  y: number;
}

export async function markdownToPdf(
  markdown: string,
  title = 'Document',
  options: MarkdownPdfOptions = {},
): Promise<Uint8Array> {
  const { bodySize, pageSize } = validatedLayout(markdown, title, options);
  const [{ PDFDocument, rgb }, fontkit, { pdfFontData, pdfFontLicense }] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
    import('./fonts.generated'),
  ]);
  const pdf = await PDFDocument.create();

  pdf.registerFontkit(fontkit.default);
  pdf.setTitle(title.trim() || 'Document');
  pdf.setCreator('Dev Toolora');

  await pdf.attach(new TextEncoder().encode(pdfFontLicense), 'Noto-Sans-OFL.txt', {
    description: 'License for the bundled Noto Sans fonts',
    mimeType: 'text/plain',
  });

  const fonts: FontEntry[] = await Promise.all(
    pdfFontData.map(async (entry): Promise<FontEntry> => {
      const font = await pdf.embedFont(base64Decode(entry.base64), { subset: true });

      return { bold: entry.bold, characters: new Set(font.getCharacterSet()), font };
    }),
  );
  const dimensions: [number, number] = pageSize === 'a4' ? [595.28, 841.89] : [612, 792];
  const margin = 54;
  const writer: PdfWriter = {
    dimensions,
    fence: undefined,
    fonts,
    margin,
    page: pdf.addPage(dimensions),
    pdf,
    rgb,
    wasBlank: true,
    y: dimensions[1] - margin,
  };
  const source = markdown.replace(/\r\n?/g, '\n').normalize('NFC');

  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(source))
    throw invalid('Markdown contains unsupported control characters.');

  for (const original of source.split('\n')) renderMarkdownLine(writer, original, bodySize);

  addPageNumbers(writer);

  return pdf.save();
}

function ensureSpace(writer: PdfWriter, height: number): void {
  if (writer.y - height >= writer.margin) return;
  if (writer.pdf.getPageCount() >= 100) throw invalid('The document exceeds the 100-page limit.');

  writer.page = writer.pdf.addPage(writer.dimensions);
  writer.y = writer.dimensions[1] - writer.margin;
}

function drawText(writer: PdfWriter, text: string, x: number, size: number, bold: boolean): void {
  for (const run of fontRuns(writer.fonts, text, bold)) {
    writer.page.drawText(run.text, {
      color: writer.rgb(0.12, 0.14, 0.18),
      font: run.font,
      size,
      x,
      y: writer.y,
    });

    x += run.font.widthOfTextAtSize(run.text, size);
  }
}

function renderMarkdownLine(writer: PdfWriter, original: string, bodySize: number): void {
  const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(original);
  const { fence } = writer;

  if (
    marker &&
    (!fence ||
      (marker[1]![0] === fence[0] && marker[1]!.length >= fence.length && !marker[2]!.trim()))
  ) {
    writer.fence = fence ? undefined : marker[1]!;
    writer.y -= 8;

    return;
  }

  const code = fence !== undefined;
  const line = original.replace(/\t/g, '    ');

  if (!line.trim()) {
    if (code) {
      ensureSpace(writer, bodySize * 1.4);
      writer.y -= bodySize * 1.4;
    } else if (!writer.wasBlank) writer.y -= bodySize * 0.7;

    writer.wasBlank = true;

    return;
  }

  writer.wasBlank = false;
  renderContentLine(writer, line, bodySize, code);
}

function renderContentLine(writer: PdfWriter, line: string, bodySize: number, code: boolean): void {
  const { margin, rgb } = writer;
  const heading = !code ? /^\s{0,3}(#{1,6})\s+(.+)$/.exec(line) : null;
  const list = !code ? /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line) : null;
  const quote = !code ? /^\s{0,3}>\s?(.*)$/.exec(line) : null;
  const size = lineFontSize(bodySize, heading, code);
  const bold = Boolean(heading);
  const indent = lineIndent(code, quote, list);
  const content = lineContent(line, heading, list, quote);
  const maxWidth = writer.dimensions[0] - margin * 2 - indent;
  const wrapped = wrapToWidth(writer.fonts, content, maxWidth, size, bold);
  const height = size * 1.5;

  if (heading) {
    ensureSpace(writer, height * 2 + 8);
    writer.y -= 8;
  }

  for (const text of wrapped) {
    ensureSpace(writer, height);
    if (code)
      writer.page.drawRectangle({
        color: rgb(0.95, 0.96, 0.98),
        height,
        width: writer.dimensions[0] - margin * 2,
        x: margin,
        y: writer.y - 4,
      });
    if (quote)
      writer.page.drawLine({
        color: rgb(0.6, 0.65, 0.72),
        end: { x: margin + 3, y: writer.y + size },
        start: { x: margin + 3, y: writer.y - 4 },
        thickness: 2,
      });

    drawText(writer, text, margin + indent, size, bold);
    writer.y -= height;
  }

  if (heading) writer.y -= 3;
}

function addPageNumbers(writer: PdfWriter): void {
  const { pdf, rgb } = writer;
  const footerFont = writer.fonts.find((entry) => !entry.bold && entry.characters.has(65))?.font;

  if (!footerFont) throw invalid('The bundled footer font is unavailable.');

  pdf.getPages().forEach((documentPage, index) => {
    const label = `${index + 1} / ${pdf.getPageCount()}`;

    documentPage.drawText(label, {
      color: rgb(0.5, 0.53, 0.58),
      font: footerFont,
      size: 9,
      x: (writer.dimensions[0] - footerFont.widthOfTextAtSize(label, 9)) / 2,
      y: 28,
    });
  });
}

function lineFontSize(bodySize: number, heading: RegExpExecArray | null, code: boolean): number {
  if (heading) return Math.max(bodySize + 1, 26 - heading[1]!.length * 2);

  return code ? bodySize - 1 : bodySize;
}

function lineIndent(
  code: boolean,
  quote: RegExpExecArray | null,
  list: RegExpExecArray | null,
): number {
  if (code || quote) return 12;
  if (list) return Math.min(72, Math.floor(list[1]!.length / 2) * 12) + 14;

  return 0;
}

function lineContent(
  line: string,
  heading: RegExpExecArray | null,
  list: RegExpExecArray | null,
  quote: RegExpExecArray | null,
): string {
  // Trailing spaces and the closing # run are stripped apart; one regex for both is quadratic.
  if (heading) return heading[2]!.replace(/(?<!\s)\s+$/, '').replace(/(?<!\s)\s+#+$/, '');
  if (list) return `${/\d/.test(list[2]!) ? list[2] : '•'} ${list[3]}`;
  if (quote) return quote[1]!;

  return line;
}

function invalid(message: string): FunctionError {
  return new FunctionError('INVALID_MARKDOWN_PDF', message);
}
