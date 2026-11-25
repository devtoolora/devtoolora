type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

// Replaces packages/functions/src/pdf/pdfjs.ts in the worker build (vite.config.ts); the host
// prepends assets/pdfjs.js, which sets globalThis.pdfjsLib, to the shared worker only.
export async function importPdfjs(): Promise<PdfJs> {
  const { pdfjsLib } = globalThis as { pdfjsLib?: PdfJs };

  if (!pdfjsLib) throw new Error('pdfjs is not loaded in this worker.');

  return pdfjsLib;
}
