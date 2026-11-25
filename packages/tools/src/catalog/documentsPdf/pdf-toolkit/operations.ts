import { ToolError, ToolResult } from '@devtoolora/core';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { zipArtifact } from '../../../adapters/files';
import { encodeText, bytesText, pdfOutput, pageList, pdfFiles } from '../shared';

// PDF /Rotate is clockwise, so 270° reads as a quarter turn left.
const rotationLabels: Record<90 | 180 | 270, string> = {
  90: '90° right',
  180: '180°',
  270: '90° left',
};

interface PdfPagesRequest {
  before: Awaited<ReturnType<typeof pdfFunctions.inspectPdf>>;
  fields: Record<string, string>;
  files: pdfFunctions.PdfFile[];
  first: pdfFunctions.PdfFile;
  name: string;
}

async function pdfInfo(files: pdfFunctions.PdfFile[]): Promise<ToolResult> {
  const reports = await withToolErrorAsync(() =>
    Promise.all(files.map((file) => pdfFunctions.inspectPdf(file))),
  );
  const text = JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2);
  const pages = reports.reduce((total, report) => total + report.pageCount, 0);
  const columns = [
    'File',
    'Pages',
    'Page size',
    'PDF version',
    'Size',
    'Encrypted',
    'Form fields',
    'Title',
  ];

  return {
    artifact: {
      base64: encodeText(text),
      fileName: 'pdf-info.json',
      mimeType: 'application/json;charset=utf-8',
    },
    jsonTable: {
      columns,
      presentation: 'plain',
      rows: reports.map((report) => [
        report.file,
        String(report.pageCount),
        report.pageSizes.join('; '),
        report.version,
        bytesText(report.bytes),
        report.encrypted ? 'Yes' : 'No',
        String(report.formFields),
        report.metadata ? report.metadata.title || '—' : 'Unavailable (encrypted)',
      ]),
    },
    language: 'json',
    summary: `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${pages} ${pages === 1 ? 'page' : 'pages'} in total${reports.some((report) => report.encrypted) ? ' · encrypted files can be inspected but not edited' : ''}.`,
    text,
  };
}

async function pdfMerge({ files }: PdfPagesRequest): Promise<ToolResult> {
  if (files.length < 2)
    throw new ToolError('Add at least two PDF files to merge, in the order you want them.');

  const bytes = await withToolErrorAsync(() => pdfFunctions.mergePdfs(files));
  const total = files.reduce((sum, file) => sum + file.bytes.length, 0);

  return pdfOutput(bytes, 'merged.pdf', `Merged ${files.length} files in the order shown`, total);
}

async function pdfSplit({ before, fields, first, name }: PdfPagesRequest): Promise<ToolResult> {
  const splitMode = fields.splitMode || 'each';

  if (splitMode !== 'each' && splitMode !== 'every' && splitMode !== 'ranges')
    throw new ToolError('Choose Each page, Every N pages or Custom ranges.');

  const parts = await withToolErrorAsync(() =>
    pdfFunctions.splitPdf(
      first,
      splitMode,
      splitMode === 'every' ? fields.splitEvery || '2' : (fields.splitRanges ?? ''),
    ),
  );
  const text = parts.map((part) => `${part.name} · ${bytesText(part.bytes.length)}`).join('\n');

  return {
    artifact: zipArtifact(parts, `${name}-split.zip`),
    language: 'plaintext',
    summary: `Split ${before.pageCount} pages into ${parts.length} ${parts.length === 1 ? 'file' : 'files'} · ZIP download.`,
    text,
  };
}

async function pdfReorder({ fields, first, name }: PdfPagesRequest): Promise<ToolResult> {
  const result = await withToolErrorAsync(() => pdfFunctions.reorderPdf(first, fields.order ?? ''));
  const omitted = result.omitted.length
    ? `; dropped pages ${pdfFunctions.formatPageSelection(result.omitted)}`
    : '';

  return pdfOutput(
    result.bytes,
    `${name}-reordered.pdf`,
    `New order ${pdfFunctions.formatPageOrder(result.pages)}${omitted}`,
    first.bytes.length,
  );
}

async function pdfRotate({ before, fields, first, name }: PdfPagesRequest): Promise<ToolResult> {
  const angle = Number(fields.angle || '90');

  if (angle !== 90 && angle !== 180 && angle !== 270)
    throw new ToolError('Rotate by 90° right, 180° or 90° left.');

  const result = await withToolErrorAsync(() =>
    pdfFunctions.rotatePdfPages(first, fields.rotatePages || 'all', angle),
  );

  return pdfOutput(
    result.bytes,
    `${name}-rotated.pdf`,
    `Rotated ${pageList(result.pages, before.pageCount)} ${rotationLabels[angle]}`,
    first.bytes.length,
  );
}

async function pdfDeletePages({
  before,
  fields,
  first,
  name,
}: PdfPagesRequest): Promise<ToolResult> {
  const result = await withToolErrorAsync(() =>
    pdfFunctions.deletePdfPages(first, fields.pages ?? ''),
  );

  return pdfOutput(
    result.bytes,
    `${name}-edited.pdf`,
    `Deleted ${pageList(result.pages, before.pageCount)}`,
    first.bytes.length,
  );
}

async function pdfExtractPages({
  before,
  fields,
  first,
  name,
}: PdfPagesRequest): Promise<ToolResult> {
  const result = await withToolErrorAsync(() =>
    pdfFunctions.extractPdfPages(first, fields.pages ?? ''),
  );

  return pdfOutput(
    result.bytes,
    `${name}-extract.pdf`,
    `Extracted ${pageList(result.pages, before.pageCount)}`,
    first.bytes.length,
  );
}

async function pdfOptimize({ first, name }: PdfPagesRequest): Promise<ToolResult> {
  const bytes = await withToolErrorAsync(() => pdfFunctions.compactPdf(first));

  return pdfOutput(
    bytes,
    `${name}-compact.pdf`,
    'Re-saved with object streams; images are not recompressed',
    first.bytes.length,
  );
}

const pdfPageOperations: Record<string, (request: PdfPagesRequest) => Promise<ToolResult>> = {
  delete: pdfDeletePages,
  extract: pdfExtractPages,
  merge: pdfMerge,
  optimize: pdfOptimize,
  reorder: pdfReorder,
  rotate: pdfRotate,
  split: pdfSplit,
};

export async function pdfPages(fields: Record<string, string>): Promise<ToolResult> {
  const files = pdfFiles(fields, true);
  const mode = fields.mode || 'merge';
  const [first] = files;

  if (mode === 'info') return pdfInfo(files);
  if (!first) throw new ToolError('PDF files are required.');

  const before = await withToolErrorAsync(() => pdfFunctions.inspectPdf(first));
  const operation = Object.hasOwn(pdfPageOperations, mode) ? pdfPageOperations[mode] : undefined;

  if (!operation)
    throw new ToolError(
      'Choose an operation: merge, split, reorder, rotate, delete, extract, details or re-save.',
    );

  return operation({ before, fields, files, first, name: pdfFunctions.pdfBaseName(first.name) });
}
