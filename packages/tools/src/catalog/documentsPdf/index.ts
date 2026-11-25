import { ToolDefinition } from '@devtoolora/core';
import { markdownToPdfTool } from './markdown-to-pdf/tool';
import {
  pdfPagesTool,
  pdfPageCounterTool,
  pdfDeletePagesTool,
  pdfExtractPagesTool,
} from './pdf-toolkit/tool';
import { pdfMetadataTool } from './pdf-metadata-editor/tool';
import { pdfTextExtractorTool } from './pdf-text-extractor/tool';
import { pdfFormFillerTool } from './pdf-form-filler/tool';
import { pdfCropResizeTool } from './pdf-crop-resize/tool';
import { pdfSignatureInspectorTool } from './pdf-signature-inspector/tool';
import { pdfCompareTool, pdfDiffTool } from './pdf-compare/tool';
import { csvToXlsxTool, jsonToXlsxTool } from './csv-to-xlsx/tool';
import { docxToMarkdownTool, docxToTextTool } from './docx-to-text/tool';
import { xlsxToCsvTool, xlsxToJsonTool } from './xlsx-to-csv/tool';
import { pdfStampTool, pdfHeaderFooterTool, pdfWatermarkTool } from './pdf-page-numbers/tool';

export * from './markdown-to-pdf/tool';
export * from './pdf-toolkit/tool';
export * from './pdf-metadata-editor/tool';
export * from './pdf-page-numbers/tool';
export * from './xlsx-to-csv/tool';
export * from './csv-to-xlsx/tool';
export * from './docx-to-text/tool';
export * from './pdf-text-extractor/tool';
export * from './pdf-form-filler/tool';
export * from './pdf-crop-resize/tool';
export * from './pdf-signature-inspector/tool';
export * from './pdf-compare/tool';

export const documentPdfTools: ToolDefinition[] = [
  markdownToPdfTool,
  pdfPagesTool,
  pdfPageCounterTool,
  pdfMetadataTool,
  pdfDeletePagesTool,
  pdfExtractPagesTool,
  pdfStampTool,
  pdfHeaderFooterTool,
  pdfWatermarkTool,
  xlsxToCsvTool,
  xlsxToJsonTool,
  csvToXlsxTool,
  jsonToXlsxTool,
  docxToTextTool,
  docxToMarkdownTool,
  pdfTextExtractorTool,
  pdfFormFillerTool,
  pdfCropResizeTool,
  pdfSignatureInspectorTool,
  pdfCompareTool,
  pdfDiffTool,
];
