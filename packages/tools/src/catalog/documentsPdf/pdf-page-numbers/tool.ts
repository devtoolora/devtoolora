import { ToolDefinition, ToolError, ToolField, ToolResult } from '@devtoolora/core';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import {
  browserSafeCapabilities,
  pdfMaxBytes,
  pdfFiles,
  pageList,
  pdfOutput,
  report,
} from '../shared';

const alignField = (
  id: string,
  label: string,
  visibleWhen: ToolField['visibleWhen'],
): ToolField => ({
  defaultValue: 'center',
  id,
  label,
  options: [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
  ],
  presentation: 'segmented',
  type: 'select',
  visibleWhen,
});
const placeholderHelp =
  'Placeholders: {n} page number, {total} last number, {date}, {file}, {title}.';

const logoPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABACAMAAACqVYydAAABy1BMVEX///8dTtggUNjs8Pv///8/ad1VeuGRqOzG0vXg5/nx9Pz7/P7v8/zY4Piuv/FykeYuW9v+/v4+aN1fguP4+v1ihOOSquxqi+X5+v6pvPAkVNmdsu6/zfO1xfLk6vooV9mwwfEyXtvy9fwnVtk9Z90sWdpXe+IjUtnI1PV6luiqvfCpu/Di6PqJoupTeeFEbd5bfuKNpuvT3PfY4figtO5jheRhg+PN2PbI0/X09v0mVdlLct+es+4hUdhMc+BWe+F7mOh1k+dBat5vjua5yPOsvvDH0/W2xvLb4/iRqezS3Pehtu7Cz/QkU9n3+P1mh+T8/P42YtxafeL6+/7j6fqEn+n9/f41Ydy0xPK6yfN5luc4Y9zn7PqHoepykOaCnek6ZN1PdeDM1/abse3a4vhujebu8fyZr+0lVNnz9f1+muhNdOCFn+qVrOzh6PmftO43Ytw5ZNzBz/TP2fajt+/t8fu3xvI0YNz3+f0vXNuGoOqvwPG4x/ItW9qhte4iUtiLpOtCa95Hb99cf+OMpevU3ffO2Pa4yPIxXdspV9pgguNAad6xwfFjhORniOSTq+xri+WrvfDK1vXl6voeT9jw8/zZ4fh2lOcwXdvf6jrfAAAAAXRSTlMAQObYZgAAAu1JREFUaN7t2glTEzEUAOBGAlYFW7DKpUCLlqKIWqwKBQseVNBiESkKXqjgibd434oX3ufPNS/Z3W63u43MrMl23DfT3eQ18/LNdBMytB6PG7YGckA4W1fAKBvFIcoG8YiyNTyhbAtXKJvCA8qWcIWyITygbAdXKJtR9EDZCq5QNsIFukDZCHuAi0owjVJDvmyxd8nSZeUVy31+1mfDKqvUAStYAvt176oRsBG4Uqm5KidbXZGdraa2TkeoV4esFgRco9Rs0OUam3LnC+oIoWY2Zm2lGOC6gFo0rOVaItgaiFvZoHosBtiqFV2v5TawRNvG9tJNm7dEDcAOOqY5ZALcGlNim33A7VB4B1w6u5RUnE3c3aP0d3pzgDgByV5sAuz7mxkXBqyihXfRlbxbye2hub2GkYzQT15J6O4jDa8A4ADUHUT74XaApVJD0BnymwIPkld6GKFD5D5SLQB4GOqOona4ZcZoKkznOmIcyQjBKNuRjpJbU5nlIhm3C5ige+8EQsegcZzmTtApTloAfeRS0nIqQ26TAoC1UO00aZyBxlmaG6VTTFkAU9PwtJ6jD8a/B56/ANUuktYlWjcOycsFgWiGXKPl5OITAJyij14QmlegeZX/EaNraWaYTuUDtX3wuk3AG1D15hjELWjehq2v8CJBaJYBZ1A+sI8748KAdzLYEDGkbjN371kB6cLC6QkBwPtGH56FNNuoH1gBET3oPEQCgB15wJpHSPtT9/iJMmwyEswBjkMjLAAYx/nRC28oh4WGp4lnz1+8fKU/LECrKzI39zqrMlsksTd2ALuhZuCt2h2kKwZaBY5bwfxP3Wybwe9sAPbQE0JS67MN+j00G+edAPxAK33U+sP0iPyJdT7rns+RL9kjv0hgEgp11mUTXyHx7bvSSwz0t4XSP37O//qt04gEyg0X6AJlhwv8P4AOFhbJf/mdD3SssGi+q3OqsIi+L3am0Ok/WnD47z48ZiEbxeE5xuhxw9b4A7L3gFLJ6JqgAAAAAElFTkSuQmCC';

const stampDefaults = {
  color: '#1f2328',
  footer: 'Page {n} of {total}',
  footerAlign: 'center',
  header: '',
  headerAlign: 'center',
  margin: '28',
  pages: 'all',
  size: '10',
  start: '1',
  watermark: '',
  watermarkAngle: '45',
  watermarkColor: '#c62828',
  watermarkImage: '',
  watermarkImageWidth: '40',
  watermarkOpacity: '18',
  watermarkSize: '0',
};

export const pdfStampTool: ToolDefinition = {
  id: 'pdf-page-numbers',
  preview: 'pdf-stamp',
  name: 'PDF Page Numbers & Watermark',
  category: 'Documents & PDF',
  description:
    'Add page numbers such as “Page 3 of 12”, a header and footer, or a diagonal DRAFT watermark to a PDF, with live preview and accented letters, locally.',
  samples: [
    { fields: { ...stampDefaults, ...report }, label: 'Page X of Y footer' },
    {
      fields: { ...stampDefaults, ...report, footer: '{n}', footerAlign: 'right', pages: '2-' },
      label: 'Number from page 2, skip the cover',
    },
    {
      fields: {
        ...stampDefaults,
        ...report,
        footer: 'Page {n} of {total}',
        footerAlign: 'right',
        header: '{title} · {date}',
        headerAlign: 'left',
      },
      label: 'Title and date header',
    },
    {
      fields: { ...stampDefaults, ...report, footer: '', watermark: 'DRAFT' },
      label: 'DRAFT watermark',
    },
    {
      fields: {
        ...stampDefaults,
        ...report,
        footer: 'Internal use only',
        header: 'CONFIDENTIAL',
        watermark: 'CONFIDENTIAL',
        watermarkAngle: '30',
        watermarkOpacity: '12',
      },
      label: 'Confidential header, footer and watermark',
    },
    {
      fields: {
        ...stampDefaults,
        ...report,
        footer: 'Strana {n} z {total}',
        header: 'Důvěrné · {file}',
        watermark: 'KONCEPT',
        watermarkColor: '#1d4ed8',
      },
      label: 'Czech text with a blue watermark',
    },
    {
      fields: {
        ...stampDefaults,
        ...report,
        footer: '',
        watermarkImage: logoPng,
        watermarkImageName: 'acme-logo.png',
        watermarkImageWidth: '50',
        watermarkOpacity: '25',
      },
      label: 'Logo image watermark',
    },
  ],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  fields: [
    {
      accept: 'application/pdf',
      id: 'pdfs',
      label: 'PDF file',
      maxBytes: pdfMaxBytes,
      required: true,
      type: 'file',
    },
    {
      help: placeholderHelp,
      id: 'header',
      label: 'Header',
      placeholder: '{title} · Confidential',
      type: 'text',
    },
    alignField('headerAlign', 'Header alignment', { field: 'header', isNot: [''] }),
    {
      defaultValue: 'Page {n} of {total}',
      help: placeholderHelp,
      id: 'footer',
      label: 'Footer',
      placeholder: 'Page {n} of {total}',
      type: 'text',
    },
    alignField('footerAlign', 'Footer alignment', { field: 'footer', isNot: [''] }),
    {
      help: 'Large diagonal text across each page.',
      id: 'watermark',
      label: 'Watermark',
      placeholder: 'DRAFT',
      type: 'text',
    },
    {
      defaultValue: '45',
      help: 'Degrees counterclockwise, -180 to 180.',
      id: 'watermarkAngle',
      label: 'Watermark angle',
      type: 'number',
      visibleWhen: { field: 'watermark', isNot: [''] },
    },
    {
      defaultValue: '0',
      help: '0 fits the text diagonally on each page; otherwise 1–300 pt.',
      id: 'watermarkSize',
      label: 'Watermark size (pt, 0 = auto)',
      type: 'number',
      visibleWhen: { field: 'watermark', isNot: [''] },
    },
    {
      defaultValue: '#c62828',
      id: 'watermarkColor',
      label: 'Watermark color',
      placeholder: '#c62828',
      type: 'text',
      visibleWhen: { field: 'watermark', isNot: [''] },
    },
    {
      accept: 'image/png,image/jpeg',
      help: 'Optional PNG or JPEG, such as a logo, drawn upright in the center of each page.',
      id: 'watermarkImage',
      label: 'Watermark image',
      maxBytes: 10 * 1024 * 1024,
      type: 'file',
    },
    {
      defaultValue: '40',
      help: '5–100% of the page width.',
      id: 'watermarkImageWidth',
      label: 'Image width (% of page)',
      type: 'number',
      visibleWhen: { field: 'watermarkImage', isNot: [''] },
    },
    {
      defaultValue: '18',
      help: '2–100, for the text and image watermark. Around 10–25 keeps the page readable.',
      id: 'watermarkOpacity',
      label: 'Watermark opacity (%)',
      type: 'number',
    },
    {
      defaultValue: 'all',
      help: 'Use 2- to skip a cover page. Numbers count only stamped pages.',
      id: 'pages',
      label: 'Pages',
      placeholder: 'all, 2-, odd',
      type: 'text',
    },
    {
      defaultValue: '1',
      help: 'The {n} value on the first stamped page.',
      id: 'start',
      label: 'First number',
      type: 'number',
    },
    {
      defaultValue: '10',
      help: '6–48 pt for the header and footer.',
      id: 'size',
      label: 'Font size',
      type: 'number',
    },
    {
      defaultValue: '28',
      help: 'Distance from the page edge, 6–144 pt (28 pt ≈ 1 cm).',
      id: 'margin',
      label: 'Margin (pt)',
      type: 'number',
    },
    {
      defaultValue: '#1f2328',
      id: 'color',
      label: 'Text color',
      placeholder: '#1f2328',
      type: 'text',
    },
  ],
  keywords: [
    'add page numbers to pdf',
    'pdf page numbers',
    'pdf header footer',
    'pdf watermark',
    'draft watermark',
    'confidential stamp',
    'bates numbering',
    'stamp pdf',
    'page x of y',
  ],
  relatedToolIds: ['pdf-toolkit', 'pdf-metadata-editor', 'markdown-to-pdf'],
  resultActions: ['save'],
  run: ({ fields }) => pdfStamp(fields),
};

const stampAlias = (
  id: string,
  name: string,
  defaults: Record<string, string>,
): ToolDefinition => ({
  ...pdfStampTool,
  aliasOf: 'pdf-page-numbers',
  fields: pdfStampTool.fields?.map((field) =>
    field.id in defaults ? { ...field, defaultValue: defaults[field.id] } : field,
  ),
  id,
  name,
  run: ({ fields }) => pdfStamp({ ...defaults, ...fields }),
});

export const pdfHeaderFooterTool = stampAlias('pdf-header-footer', 'PDF Header & Footer', {
  header: '{title}',
});
export const pdfWatermarkTool = stampAlias('pdf-watermark', 'PDF Watermark', {
  footer: '',
  watermark: 'DRAFT',
});

async function pdfStamp(fields: Record<string, string>): Promise<ToolResult> {
  const [file] = pdfFiles(fields, false);

  if (!file) throw new ToolError('PDF file is required.');

  const opacity = optionalNumber(fields.watermarkOpacity, 'Watermark opacity');

  const align = (value: string | undefined, label: string): pdfFunctions.PdfTextAlign => {
    const choice = value || 'center';

    if (choice !== 'left' && choice !== 'center' && choice !== 'right')
      throw new ToolError(`${label} must be left, center or right.`);

    return choice;
  };

  const result = await withToolErrorAsync(() =>
    pdfFunctions.stampPdf(file, {
      color: fields.color || undefined,
      footer: fields.footer,
      footerAlign: align(fields.footerAlign, 'Footer alignment'),
      header: fields.header,
      headerAlign: align(fields.headerAlign, 'Header alignment'),
      margin: optionalNumber(fields.margin, 'Margin'),
      pages: fields.pages,
      size: optionalNumber(fields.size, 'Font size'),
      start: optionalNumber(fields.start, 'First number'),
      watermark: fields.watermark,
      watermarkAngle: optionalNumber(fields.watermarkAngle, 'Watermark angle'),
      watermarkColor: fields.watermarkColor || undefined,
      watermarkImage: fields.watermarkImage
        ? {
            ...fileBytesFromField(fields.watermarkImage, 'Watermark image'),
            name: fields.watermarkImageName || 'watermark image',
          }
        : undefined,
      watermarkImageWidth: optionalNumber(fields.watermarkImageWidth, 'Image width'),
      watermarkOpacity: opacity === undefined ? undefined : opacity / 100,
      watermarkSize: optionalNumber(fields.watermarkSize, 'Watermark size'),
    }),
  );
  const count = (await withToolErrorAsync(() => pdfFunctions.inspectPdf(file))).pageCount;
  const added = [
    fields.header?.trim() && 'header',
    fields.footer?.trim() && 'footer',
    fields.watermark?.trim() && `watermark at ${opacity ?? 18}%`,
    fields.watermarkImage && `image watermark at ${opacity ?? 18}%`,
  ]
    .filter(Boolean)
    .join(', ');
  const summary = [`Added ${added} to ${pageList(result.pages, count)}.`, ...result.warnings].join(
    ' ',
  );

  return pdfOutput(
    result.bytes,
    `${pdfFunctions.pdfBaseName(file.name)}-stamped.pdf`,
    summary.replace(/\.$/, ''),
    file.bytes.length,
  );
}

function optionalNumber(value: string | undefined, label: string): number | undefined {
  if (value === undefined || !value.trim()) return undefined;

  const number = Number(value);

  if (!Number.isFinite(number)) throw new ToolError(`${label} must be a number.`);

  return number;
}
