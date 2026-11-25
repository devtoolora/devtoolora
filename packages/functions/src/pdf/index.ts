import { createPdf, pdfError } from './document';

export { baseName as pdfBaseName, pdfVersion, type PdfFile } from './document';
export { markdownToPdf, type MarkdownPdfOptions } from './markdown';
export {
  editPdfMetadata,
  removePdfMetadata,
  type PdfMetadataEdit,
  type PdfMetadataResult,
} from './metadata';
export {
  compactPdf,
  deletePdfPages,
  extractPdfPages,
  formatPageOrder,
  formatPageSelection,
  inspectPdf,
  mergePdfs,
  pageSizeLabel,
  parsePageSelection,
  pdfPaperSizes,
  reorderPdf,
  rotatePdfPages,
  splitPdf,
  splitPdfGroups,
  type PdfInfo,
  type PdfMetadata,
  type PdfRotation,
  type PdfSplitMode,
} from './pages';
export {
  pdfStampPlaceholders,
  stampPdf,
  type PdfStampOptions,
  type PdfStampResult,
  type PdfTextAlign,
} from './stamp';
export { cropPdf, resizePdf, type PdfBoxReport, type PdfBoxResult } from './boxes';
export { fillPdfForm, listPdfFormFields, type PdfFormField } from './forms';
export {
  inspectPdfSignatures,
  type PdfSignatureInspection,
  type PdfSignatureReport,
} from './signatures';
export { comparePdfs, type PdfComparison } from './compare';
export { extractPdfText } from './text';

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// No byte limit: callers pass PNGs they rendered, already bounded by the canvas pixel cap.
export async function imageToPdf(pngBytes: Uint8Array): Promise<Uint8Array> {
  if (!pngSignature.every((byte, index) => pngBytes[index] === byte))
    throw pdfError('The image is not a PNG.');

  const pdf = await createPdf();
  const image = await pdf.embedPng(pngBytes).catch(() => {
    throw pdfError('The PNG image could not be read.');
  });
  const page = pdf.addPage([image.width, image.height]);

  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  return pdf.save();
}
