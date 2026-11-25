import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { booleanField, choiceField, numericField } from '../../../adapters/fields';
import {
  browserSafeCapabilities,
  pdfFiles,
  pdfMaxBytes,
  pdfOutput,
  reportPdf,
  signatureNotes,
} from '../shared';

const units = { in: 72, mm: 72 / 25.4, pt: 1 } as const;
const unitNames = ['mm', 'pt', 'in'] as const;
const orientations = ['auto', 'portrait', 'landscape'] as const;
const paperNames = [...pdfFunctions.pdfPaperSizes.map(([name]) => name), 'custom'];
const cropping = { field: 'mode', is: ['crop'] };
const resizing = { field: 'mode', is: ['resize'] };
const sample = { pdfs: reportPdf };
const defaults = { mode: 'crop', pages: '', paperSize: 'A4', scaleContent: 'true', unit: 'mm' };

const marginField = (id: string, label: string): ToolField => ({
  defaultValue: '10',
  id,
  label,
  type: 'number',
  visibleWhen: cropping,
});

function points(value: string | undefined, label: string, unit: number, min: number): number {
  return numericField(value, label, min, 1_000_000, Number.NaN, 4) * unit;
}

function sizeReport(size: { height: number; width: number }) {
  const mm = (value: number) => Math.round(((value * 25.4) / 72) * 10) / 10;

  return { ...size, mm: { height: mm(size.height), width: mm(size.width) } };
}

function paperSize(fields: Record<string, string>, unit: number): [number, number] {
  const name = choiceField(
    fields.paperSize,
    'A4',
    paperNames,
    'Choose a paper size from the list.',
  );

  if (name === 'custom')
    return [
      points(fields.customWidth, 'Custom width', unit, 0.01),
      points(fields.customHeight, 'Custom height', unit, 0.01),
    ];

  const size = pdfFunctions.pdfPaperSizes.find(([entry]) => entry === name);

  if (!size) throw new ToolError(`Unknown paper size ${name}.`);

  return [size[1], size[2]];
}

async function cropOrResize(fields: Record<string, string>): Promise<ToolResult> {
  const [file] = pdfFiles(fields, false);

  if (!file) throw new ToolError('PDF file is required.');

  const crop =
    choiceField(fields.mode, 'crop', ['crop', 'resize'], 'Choose Crop or Resize as the action.') ===
    'crop';
  const unit = units[choiceField(fields.unit, 'mm', unitNames, 'Choose mm, pt or in as the unit.')];
  const pages = fields.pages ?? '';
  const margin = (id: string, label: string) =>
    numericField(fields[id], label, 0, 1_000_000, 10, 4) * unit;
  const result = await withToolErrorAsync(() => {
    if (crop)
      return pdfFunctions.cropPdf(file, {
        margins: {
          bottom: margin('bottom', 'Bottom'),
          left: margin('left', 'Left'),
          right: margin('right', 'Right'),
          top: margin('top', 'Top'),
        },
        pages,
      });

    const [width, height] = paperSize(fields, unit);

    return pdfFunctions.resizePdf(file, {
      height,
      orientation: choiceField(
        fields.orientation,
        'auto',
        orientations,
        'Choose auto, portrait or landscape as the orientation.',
      ),
      pages,
      scaleContent: booleanField(fields.scaleContent, true),
      width,
    });
  });
  const count = result.pages.length;
  const summary = [
    crop
      ? `Cropped ${count} ${count === 1 ? 'page' : 'pages'}; the MediaBox is unchanged, so the cropped area can be recovered`
      : `Resized ${count} ${count === 1 ? 'page' : 'pages'}`,
    ...signatureNotes(file.bytes),
  ].join(' · ');
  const output = pdfOutput(
    result.bytes,
    `${pdfFunctions.pdfBaseName(file.name)}-${crop ? 'cropped' : 'resized'}.pdf`,
    summary,
    file.bytes.length,
  );
  const report = result.pages.map(({ after, before, page }) => ({
    after: sizeReport(after),
    before: sizeReport(before),
    page,
  }));

  return { ...output, language: 'json', text: JSON.stringify(report, null, 2) };
}

export const pdfCropResizeTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'Crop margins off PDF pages or resize them to A4, Letter or a custom paper size with the content scaled and centered, locally.',
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
      defaultValue: 'crop',
      id: 'mode',
      label: 'Action',
      options: [
        { label: 'Crop', value: 'crop' },
        { label: 'Resize', value: 'resize' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'Leave blank for all pages, or use ranges such as 1-3, 5, 8-, last, odd or even.',
      id: 'pages',
      label: 'Pages',
      placeholder: 'all, 2-, odd',
      type: 'text',
    },
    {
      defaultValue: 'mm',
      id: 'unit',
      label: 'Unit',
      options: [
        { label: 'Millimetres', value: 'mm' },
        { label: 'Points', value: 'pt' },
        { label: 'Inches', value: 'in' },
      ],
      type: 'select',
    },
    marginField('top', 'Top'),
    marginField('right', 'Right'),
    marginField('bottom', 'Bottom'),
    marginField('left', 'Left'),
    {
      defaultValue: 'A4',
      id: 'paperSize',
      label: 'Paper size',
      options: paperNames.map((name) => ({
        label: name === 'custom' ? 'Custom' : name,
        value: name,
      })),
      type: 'select',
      visibleWhen: resizing,
    },
    {
      id: 'customWidth',
      label: 'Custom width',
      type: 'number',
      visibleWhen: [resizing, { field: 'paperSize', is: ['custom'] }],
    },
    {
      id: 'customHeight',
      label: 'Custom height',
      type: 'number',
      visibleWhen: [resizing, { field: 'paperSize', is: ['custom'] }],
    },
    {
      defaultValue: 'auto',
      help: 'Auto keeps each page portrait or landscape as it is displayed.',
      id: 'orientation',
      label: 'Orientation',
      options: [
        { label: 'Auto', value: 'auto' },
        { label: 'Portrait', value: 'portrait' },
        { label: 'Landscape', value: 'landscape' },
      ],
      type: 'select',
      visibleWhen: resizing,
    },
    {
      defaultValue: 'true',
      help: 'Scales the page content to fit the new size. Off keeps the size and centers it.',
      id: 'scaleContent',
      label: 'Scale content',
      type: 'checkbox',
      visibleWhen: resizing,
    },
  ],
  freshResults: true,
  id: 'pdf-crop-resize',
  inputKind: 'none',
  keywords: [
    'crop pdf',
    'resize pdf',
    'pdf margins',
    'pdf page size',
    'change pdf paper size',
    'trim pdf',
  ],
  name: 'PDF Crop & Resize',
  outputKind: 'text',
  relatedToolIds: ['pdf-toolkit', 'pdf-metadata-editor', 'pdf-text-extractor'],
  resultActions: ['save'],
  run: ({ fields }) => cropOrResize(fields),
  samples: [
    { fields: { ...defaults, ...sample }, label: 'Crop 10 mm on every side' },
    {
      fields: { ...defaults, ...sample, bottom: '0', left: '0', right: '0', top: '25' },
      label: 'Trim the top 25 mm',
    },
    { fields: { ...defaults, ...sample, mode: 'resize' }, label: 'Resize to A4' },
    {
      fields: { ...defaults, ...sample, mode: 'resize', paperSize: 'Letter' },
      label: 'Resize to Letter',
    },
    {
      fields: { ...defaults, ...sample, mode: 'resize', orientation: 'landscape', paperSize: 'A5' },
      label: 'Landscape A5',
    },
    {
      fields: {
        ...defaults,
        ...sample,
        customHeight: '10',
        customWidth: '7',
        mode: 'resize',
        paperSize: 'custom',
        scaleContent: 'false',
        unit: 'in',
      },
      label: 'Custom 7 × 10 in, no scaling',
    },
  ],
  supportsSelection: false,
};
