import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { baseName, loadPdfLib, openPdf, pdfError, type PdfFile } from './document';
import { codePointLabel, embedBundledFont, splitFontRuns } from './fontRuns';
import { parsePageSelection } from './pages';

export type PdfTextAlign = 'center' | 'left' | 'right';

export type PdfStampOptions = {
  color?: string;
  footer?: string;
  footerAlign?: PdfTextAlign;
  header?: string;
  headerAlign?: PdfTextAlign;
  margin?: number;
  now?: Date;
  pages?: string;
  size?: number;
  start?: number;
  watermark?: string;
  watermarkAngle?: number;
  watermarkColor?: string;
  watermarkImage?: PdfFile;
  watermarkImageWidth?: number;
  watermarkOpacity?: number;
  watermarkSize?: number;
};

export type PdfStampResult = { bytes: Uint8Array; pages: number[]; warnings: string[] };

type Rgb = { blue: number; green: number; red: number };
type FontSet = {
  bold: Array<{ characters: Set<number>; font: PDFFont }>;
  regular: Array<{ characters: Set<number>; font: PDFFont }>;
};

export const pdfStampPlaceholders = ['{n}', '{total}', '{date}', '{file}', '{title}'] as const;

interface StampSettings {
  angle: number;
  color: Rgb;
  footer: string;
  footerAlign: PdfTextAlign;
  header: string;
  headerAlign: PdfTextAlign;
  image: PdfFile | undefined;
  imageWidth: number;
  margin: number;
  opacity: number;
  size: number;
  start: number;
  watermark: string;
  watermarkColor: Rgb;
  watermarkSize: number;
}

interface PageStamper {
  embeddedImage: PDFImage | undefined;
  fonts: FontSet;
  pdfLib: typeof import('pdf-lib');
  settings: StampSettings;
  warnings: Set<string>;
}

function stampSettings(options: PdfStampOptions): StampSettings {
  const header = (options.header ?? '').trim();
  const footer = (options.footer ?? '').trim();
  const watermark = (options.watermark ?? '').trim();
  const image = options.watermarkImage?.bytes.length ? options.watermarkImage : undefined;

  if (!header && !footer && !watermark && !image)
    throw pdfError('Enter a header, a footer or a watermark, or choose a watermark image.');

  for (const text of [header, footer]) checkPlaceholders(text);
  const size = boundedNumber(options.size, 10, 6, 48, 'Font size');
  const margin = boundedNumber(options.margin, 28, 6, 144, 'Margin');
  const start = boundedNumber(options.start, 1, -9999, 99999, 'First number');

  if (!Number.isInteger(start)) throw pdfError('First number must be a whole number.');

  const angle = boundedNumber(options.watermarkAngle, 45, -180, 180, 'Watermark angle');
  const opacity = boundedNumber(options.watermarkOpacity, 0.18, 0.02, 1, 'Watermark opacity');
  const watermarkSize = boundedNumber(options.watermarkSize, 0, 0, 300, 'Watermark size');
  const imageWidth = boundedNumber(options.watermarkImageWidth, 40, 5, 100, 'Image width');
  const color = parseHexColor(options.color ?? '#1f2328', 'Text color');
  const watermarkColor = parseHexColor(options.watermarkColor ?? '#c62828', 'Watermark color');

  return {
    angle,
    color,
    footer,
    footerAlign: options.footerAlign ?? 'center',
    header,
    headerAlign: options.headerAlign ?? 'center',
    image,
    imageWidth,
    margin,
    opacity,
    size,
    start,
    watermark,
    watermarkColor,
    watermarkSize,
  };
}

async function embedStampFonts(
  pdf: PDFDocument,
  fontData: ReadonlyArray<{ base64: string; bold: boolean }>,
  settings: StampSettings,
): Promise<FontSet> {
  const fonts: FontSet = { bold: [], regular: [] };

  for (const entry of fontData) {
    if (entry.bold ? !settings.watermark : !settings.header && !settings.footer) continue;

    fonts[entry.bold ? 'bold' : 'regular'].push(await embedBundledFont(pdf, entry.base64));
  }

  return fonts;
}

export async function stampPdf(file: PdfFile, options: PdfStampOptions): Promise<PdfStampResult> {
  const settings = stampSettings(options);
  const [pdfLib, fontkit, { pdfFontData }] = await Promise.all([
    loadPdfLib(),
    import('@pdf-lib/fontkit'),
    import('./fonts.generated'),
  ]);
  const pdf = await openPdf(file);

  pdf.registerFontkit(fontkit.default);
  const pages = parsePageSelection(options.pages?.trim() || 'all', pdf.getPageCount());
  const embeddedImage = settings.image ? await embedImage(pdf, settings.image) : undefined;
  const fonts = await embedStampFonts(pdf, pdfFontData, settings);
  const title = pdf.getTitle() || baseName(file.name);
  const date = localDate(options.now ?? new Date());
  const total = settings.start + pages.length - 1;
  const stamper: PageStamper = { embeddedImage, fonts, pdfLib, settings, warnings: new Set() };

  pages.forEach((number, index) => {
    const values: Record<string, string> = {
      '{date}': date,
      '{file}': baseName(file.name),
      '{n}': String(settings.start + index),
      '{title}': title,
      '{total}': String(total),
    };

    stampPage(stamper, pdf.getPage(number - 1), number, values);
  });

  return { bytes: await pdf.save(), pages, warnings: [...stamper.warnings] };
}

function stampPage(
  stamper: PageStamper,
  page: PDFPage,
  number: number,
  values: Record<string, string>,
): void {
  const { header, footer, headerAlign, footerAlign } = stamper.settings;
  const box = visualBox(page);

  if (stamper.embeddedImage) drawImageWatermark(stamper, stamper.embeddedImage, page, box);

  for (const [text, align, top] of [
    [header, headerAlign, true],
    [footer, footerAlign, false],
  ] as const) {
    if (text)
      drawHeaderOrFooter(stamper, page, box, {
        align,
        number,
        text: text.replace(/\{(n|total|date|file|title)\}/g, (match) => values[match] ?? match),
        top,
      });
  }

  if (stamper.settings.watermark) drawTextWatermark(stamper, page, box);
}

function drawImageWatermark(
  { pdfLib, settings }: PageStamper,
  image: PDFImage,
  page: PDFPage,
  box: VisualBox,
): void {
  let width = (box.width * settings.imageWidth) / 100;
  let height = (width * image.height) / image.width;

  if (height > box.height * 0.9) {
    width *= (box.height * 0.9) / height;
    height = box.height * 0.9;
  }

  const [x, y] = pagePoint(box, (box.width - width) / 2, (box.height - height) / 2);

  page.drawImage(image, {
    height,
    opacity: settings.opacity,
    rotate: pdfLib.degrees(box.rotation),
    width,
    x,
    y,
  });
}

function drawHeaderOrFooter(
  { fonts, pdfLib, settings, warnings }: PageStamper,
  page: PDFPage,
  box: VisualBox,
  line: { align: PdfTextAlign; number: number; text: string; top: boolean },
): void {
  const { margin, size } = settings;
  const { align, number, text: content, top } = line;
  let fontSize = size;
  const available = box.width - margin * 2;

  while (fontSize > 6 && textWidth(content, fontSize, fonts.regular) > available) fontSize -= 0.5;
  if (textWidth(content, fontSize, fonts.regular) > available)
    throw pdfError(
      `"${content}" does not fit between the margins on page ${number}, even at 6 pt.`,
    );
  if (fontSize < size)
    warnings.add(
      `Long ${top ? 'header' : 'footer'} text was reduced to ${fontSize} pt to fit between the margins.`,
    );

  const width = textWidth(content, fontSize, fonts.regular);
  const x = alignedX(align, box.width, margin, width);
  const y = top ? box.height - margin - fontSize * 0.75 : margin;

  drawText(pdfLib, page, box, content, {
    angle: 0,
    color: settings.color,
    font: fonts.regular,
    opacity: 1,
    size: fontSize,
    x,
    y,
  });
}

function drawTextWatermark(
  { fonts, pdfLib, settings, warnings }: PageStamper,
  page: PDFPage,
  box: VisualBox,
): void {
  const { angle, watermark, watermarkSize } = settings;
  const radians = (angle * Math.PI) / 180;
  const span = Math.min(
    box.width / Math.max(Math.abs(Math.cos(radians)), 0.01),
    box.height / Math.max(Math.abs(Math.sin(radians)), 0.01),
  );
  const fitted = (span * 0.8) / Math.max(textWidth(watermark, 1, fonts.bold), 0.01);
  const fontSize = watermarkSize || Math.max(12, Math.min(160, fitted, box.height * 0.5));

  if (watermarkSize && watermarkSize > fitted)
    warnings.add(
      `The watermark is wider than some pages at ${watermarkSize} pt; choose Auto size to fit it.`,
    );

  const width = textWidth(watermark, fontSize, fonts.bold);
  const capHeight = fontSize * 0.7;
  const x = box.width / 2 - (Math.cos(radians) * width) / 2 + (Math.sin(radians) * capHeight) / 2;
  const y = box.height / 2 - (Math.sin(radians) * width) / 2 - (Math.cos(radians) * capHeight) / 2;

  drawText(pdfLib, page, box, watermark, {
    angle,
    color: settings.watermarkColor,
    font: fonts.bold,
    opacity: settings.opacity,
    size: fontSize,
    x,
    y,
  });
}

type VisualBox = {
  cropHeight: number;
  cropWidth: number;
  height: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

function alignedX(align: PdfTextAlign, boxWidth: number, margin: number, width: number): number {
  if (align === 'left') return margin;
  if (align === 'right') return boxWidth - margin - width;

  return (boxWidth - width) / 2;
}

function visualBox(page: PDFPage): VisualBox {
  const crop = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const sideways = rotation === 90 || rotation === 270;

  return {
    cropHeight: crop.height,
    cropWidth: crop.width,
    height: sideways ? crop.width : crop.height,
    rotation,
    width: sideways ? crop.height : crop.width,
    x: crop.x,
    y: crop.y,
  };
}

function pagePoint(box: VisualBox, vx: number, vy: number): [number, number] {
  if (box.rotation === 90) return [box.x + box.cropWidth - vy, box.y + vx];
  if (box.rotation === 180) return [box.x + box.cropWidth - vx, box.y + box.cropHeight - vy];
  if (box.rotation === 270) return [box.x + vy, box.y + box.cropHeight - vx];

  return [box.x + vx, box.y + vy];
}

async function embedImage(pdf: PDFDocument, image: PdfFile): Promise<PDFImage> {
  const { bytes } = image;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (!png && !jpeg) throw pdfError(`${image.name} is not a PNG or JPEG image.`);

  try {
    return png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    throw pdfError(`${image.name} could not be read as a ${png ? 'PNG' : 'JPEG'} image.`);
  }
}

function drawText(
  pdfLib: typeof import('pdf-lib'),
  page: PDFPage,
  box: VisualBox,
  text: string,
  options: {
    angle: number;
    color: Rgb;
    font: FontSet['regular'];
    opacity: number;
    size: number;
    x: number;
    y: number;
  },
): void {
  const radians = (options.angle * Math.PI) / 180;
  let advance = 0;

  for (const run of runs(text, options.font)) {
    const [x, y] = pagePoint(
      box,
      options.x + Math.cos(radians) * advance,
      options.y + Math.sin(radians) * advance,
    );

    page.drawText(run.text, {
      color: pdfLib.rgb(options.color.red, options.color.green, options.color.blue),
      font: run.font,
      opacity: options.opacity,
      rotate: pdfLib.degrees(options.angle + box.rotation),
      size: options.size,
      x,
      y,
    });

    advance += run.font.widthOfTextAtSize(run.text, options.size);
  }
}

function runs(text: string, fonts: FontSet['regular']): Array<{ font: PDFFont; text: string }> {
  return splitFontRuns(text, fonts, (character, code) =>
    pdfError(
      `"${character}" (${codePointLabel(code)}) is not in the bundled fonts, which cover Latin and Latin Extended scripts, not emoji or other writing systems.`,
    ),
  );
}

function textWidth(text: string, size: number, fonts: FontSet['regular']): number {
  return runs(text, fonts).reduce(
    (total, run) => total + run.font.widthOfTextAtSize(run.text, size),
    0,
  );
}

function checkPlaceholders(text: string): void {
  const unknown = [...text.matchAll(/\{[^{}]*\}/g)]
    .map((match) => match[0])
    .filter((token) => !(pdfStampPlaceholders as readonly string[]).includes(token));

  if (unknown.length)
    throw pdfError(`${unknown[0]} is not a placeholder. Use ${pdfStampPlaceholders.join(', ')}.`);
  if (/[\u0000-\u001f\u007f]/.test(text))
    throw pdfError('Header and footer text cannot contain line breaks or control characters.');
}

function parseHexColor(value: string, label: string): Rgb {
  const hex = value.trim().replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(hex) ? [...hex].map((digit) => digit + digit).join('') : hex;

  if (!/^[0-9a-f]{6}$/i.test(full)) throw pdfError(`${label} must be a hex color such as #1f2328.`);

  return {
    blue: parseInt(full.slice(4, 6), 16) / 255,
    green: parseInt(full.slice(2, 4), 16) / 255,
    red: parseInt(full.slice(0, 2), 16) / 255,
  };
}

function boundedNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  if (!Number.isFinite(value) || value < min || value > max)
    throw pdfError(`${label} must be from ${min} to ${max}.`);

  return value;
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
