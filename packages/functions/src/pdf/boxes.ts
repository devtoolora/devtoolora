import type { PDFArray, PDFPage } from 'pdf-lib';
import { loadPdfLib, openPdf, pdfError, type PdfFile, type PdfLib } from './document';
import { parsePageSelection } from './pages';

export type PdfBoxReport = {
  after: { height: number; width: number };
  before: { height: number; width: number };
  page: number;
};

export type PdfBoxResult = { bytes: Uint8Array; pages: PdfBoxReport[] };

type Rectangle = { x1: number; x2: number; y1: number; y2: number };

const maxPoints = 14_400;
const staleBoxes = ['ArtBox', 'BleedBox', 'TrimBox'];
// Annotation arrays that hold x y pairs; /RD holds offsets, which only scale.
const pointArrays = ['CL', 'L', 'QuadPoints', 'Rect', 'Vertices'];

function quarterTurns(page: PDFPage): number {
  return ((Math.round(page.getRotation().angle / 90) % 4) + 4) % 4;
}

function boxOf(page: PDFPage): Rectangle {
  const sides = ({
    height,
    width,
    x,
    y,
  }: {
    height: number;
    width: number;
    x: number;
    y: number;
  }) => ({
    x1: Math.min(x, x + width),
    x2: Math.max(x, x + width),
    y1: Math.min(y, y + height),
    y2: Math.max(y, y + height),
  });
  const media = sides(page.getMediaBox());
  const crop = sides(page.getCropBox());
  // ISO 32000: the visible box is the CropBox clipped to the MediaBox.
  const clipped = {
    x1: Math.max(media.x1, crop.x1),
    x2: Math.min(media.x2, crop.x2),
    y1: Math.max(media.y1, crop.y1),
    y2: Math.min(media.y2, crop.y2),
  };

  return clipped.x2 - clipped.x1 > 0 && clipped.y2 - clipped.y1 > 0 ? clipped : media;
}

function displayedSize(box: Rectangle, turns: number): { height: number; width: number } {
  const size = { height: box.y2 - box.y1, width: box.x2 - box.x1 };

  return turns % 2 ? { height: size.width, width: size.height } : size;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function rounded(size: { height: number; width: number }): { height: number; width: number } {
  return { height: round(size.height), width: round(size.width) };
}

async function openSelected(file: PdfFile, pages: string) {
  const pdf = await openPdf(file);
  const selected = parsePageSelection(pages.trim() || 'all', pdf.getPageCount());

  return { pdf, selected };
}

export async function cropPdf(
  file: PdfFile,
  options: {
    margins: { bottom: number; left: number; right: number; top: number };
    pages: string;
  },
): Promise<PdfBoxResult> {
  const { bottom, left, right, top } = options.margins;

  if (![bottom, left, right, top].every((margin) => Number.isFinite(margin) && margin >= 0))
    throw pdfError('Crop margins must be numbers from 0.');

  const { pdf, selected } = await openSelected(file, options.pages);
  const reports: PdfBoxReport[] = [];

  for (const number of selected) {
    const page = pdf.getPage(number - 1);
    const turns = quarterTurns(page);
    const box = boxOf(page);
    const stored = [0, 0, 0, 0];

    [top, right, bottom, left].forEach((margin, side) => {
      stored[(side - turns + 4) % 4] = margin;
    });

    const next = {
      x1: box.x1 + (stored[3] ?? 0),
      x2: box.x2 - (stored[1] ?? 0),
      y1: box.y1 + (stored[2] ?? 0),
      y2: box.y2 - (stored[0] ?? 0),
    };

    if (next.x2 - next.x1 < 1 || next.y2 - next.y1 < 1)
      throw pdfError(
        `Page ${number} would be smaller than 1 pt after cropping. Use smaller margins.`,
      );

    page.setCropBox(next.x1, next.y1, next.x2 - next.x1, next.y2 - next.y1);

    reports.push({
      after: rounded(displayedSize(next, turns)),
      before: rounded(displayedSize(box, turns)),
      page: number,
    });
  }

  return { bytes: await pdf.save(), pages: reports };
}

function moveAnnotations(lib: PdfLib, page: PDFPage, scale: number, dx: number, dy: number): void {
  const { PDFDict, PDFName, PDFNumber } = lib;
  const { PDFArray: ArrayClass } = lib;

  const movePairs = (list: PDFArray) => {
    for (let at = 0; at + 1 < list.size(); at += 2) {
      const x = list.lookup(at);
      const y = list.lookup(at + 1);

      if (x instanceof PDFNumber && y instanceof PDFNumber) {
        list.set(at, PDFNumber.of(x.asNumber() + dx));
        list.set(at + 1, PDFNumber.of(y.asNumber() + dy));
      }
    }
  };

  const own = page.node.Annots();

  // Pages may share one /Annots array; give this page its own before editing.
  if (own) page.node.set(PDFName.of('Annots'), page.doc.context.obj(own.asArray()));

  page.scaleAnnotations(scale, scale);

  const annots = page.node.Annots();

  for (let index = 0; index < (annots?.size() ?? 0); index += 1) {
    const annot = annots?.lookup(index);

    if (!(annot instanceof PDFDict)) continue;

    for (const key of pointArrays) {
      const list = annot.lookup(PDFName.of(key));

      if (list instanceof ArrayClass) movePairs(list);
    }

    const ink = annot.lookup(PDFName.of('InkList'));

    for (let at = 0; ink instanceof ArrayClass && at < ink.size(); at += 1) {
      const stroke = ink.lookup(at);

      if (stroke instanceof ArrayClass) movePairs(stroke);
    }
  }
}

function placeContent(
  lib: PdfLib,
  page: PDFPage,
  box: Rectangle,
  scale: number,
  dx: number,
  dy: number,
): void {
  const { node } = page;
  const context = page.doc.context;
  const clip = `${box.x1} ${box.y1} ${box.x2 - box.x1} ${box.y2 - box.y1} re W n`;
  const matrix = [scale, 0, 0, scale, dx, dy].map((value) => Number(value.toFixed(6))).join(' ');

  node.normalize();

  const own = node.Contents();

  // Pages may share one /Contents array; wrap a private copy, not the shared one.
  node.set(
    lib.PDFName.of('Contents'),
    context.obj(own instanceof lib.PDFArray ? own.asArray() : []),
  );

  node.wrapContentStreams(
    context.register(context.stream(`q ${matrix} cm ${clip}`)),
    context.register(context.stream('Q')),
  );
}

export async function resizePdf(
  file: PdfFile,
  options: {
    height: number;
    orientation: 'auto' | 'landscape' | 'portrait';
    pages: string;
    scaleContent: boolean;
    width: number;
  },
): Promise<PdfBoxResult> {
  const { height, orientation, scaleContent, width } = options;

  for (const size of [width, height])
    if (!Number.isFinite(size) || size < 1 || size > maxPoints)
      throw pdfError(`The page size must be between 1 and ${maxPoints} pt on each side.`);

  const lib = await loadPdfLib();
  const { pdf, selected } = await openSelected(file, options.pages);
  const reports: PdfBoxReport[] = [];
  const short = Math.min(width, height);
  const long = Math.max(width, height);

  for (const number of selected) {
    const page = pdf.getPage(number - 1);
    const turns = quarterTurns(page);
    const box = boxOf(page);
    const shown = displayedSize(box, turns);
    const landscape =
      orientation === 'auto' ? shown.width > shown.height : orientation === 'landscape';
    const target = landscape ? { height: short, width: long } : { height: long, width: short };
    // /Rotate stays, so the stored box is the displayed target turned back.
    const stored = turns % 2 ? { height: target.width, width: target.height } : target;
    const oldWidth = box.x2 - box.x1;
    const oldHeight = box.y2 - box.y1;
    const scale = scaleContent ? Math.min(stored.width / oldWidth, stored.height / oldHeight) : 1;
    const dx = (stored.width - oldWidth * scale) / 2 - box.x1 * scale;
    const dy = (stored.height - oldHeight * scale) / 2 - box.y1 * scale;

    placeContent(lib, page, box, scale, dx, dy);
    moveAnnotations(lib, page, scale, dx, dy);
    page.setMediaBox(0, 0, stored.width, stored.height);
    page.setCropBox(0, 0, stored.width, stored.height);

    for (const name of staleBoxes) page.node.delete(lib.PDFName.of(name));

    reports.push({ after: rounded(target), before: rounded(shown), page: number });
  }

  return { bytes: await pdf.save(), pages: reports };
}
