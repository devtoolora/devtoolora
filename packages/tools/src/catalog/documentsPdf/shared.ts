import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { fileBytesFromField, filesFromField } from '../../adapters/files';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const pdfMaxBytes = 50 * 1024 * 1024;

export function pdfFiles(
  fields: Record<string, string>,
  multiple: boolean,
): pdfFunctions.PdfFile[] {
  const value = fields.pdfs;
  const files = value?.startsWith('data:')
    ? [{ ...fileBytesFromField(value, 'PDF file'), name: fields.pdfsName || 'document.pdf' }]
    : filesFromField(value, multiple ? 'PDF files' : 'PDF file');

  return files.map((file) => ({ bytes: file.bytes, name: file.name }));
}

export function pdfOutput(
  bytes: Uint8Array,
  fileName: string,
  summary: string,
  sourceBytes: number,
): ToolResult {
  const text = `${summary}.\n${fileName} · ${bytesText(sourceBytes)} → ${bytesText(bytes.length)}`;

  return {
    artifact: { base64: base64Encode(bytes), fileName, mimeType: 'application/pdf' },
    language: 'plaintext',
    summary: `${summary} · ${bytesText(sourceBytes)} → ${bytesText(bytes.length)}.`,
    text,
  };
}

export function pageList(pages: number[], count: number): string {
  if (pages.length === count) return `all ${count} ${count === 1 ? 'page' : 'pages'}`;

  return `${pages.length === 1 ? 'page' : 'pages'} ${pdfFunctions.formatPageSelection(pages)} of ${count}`;
}

export function signatureNotes(bytes: Uint8Array): string[] {
  return new TextDecoder('latin1').decode(bytes).includes('/ByteRange')
    ? ['existing digital signatures no longer validate']
    : [];
}

export function bytesText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function encodeText(text: string): string {
  return base64Encode(new TextEncoder().encode(text));
}

export const reportPdf =
  'data:application/pdf;base64,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';

export const report = { pdfs: reportPdf, pdfsName: 'quarterly-report.pdf' };
