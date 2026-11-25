export type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

/**
 * Loads pdfjs as lazy chunks. The VS Code tool worker build swaps this module for one that loads
 * a separate script on first use (apps/vscode/vite.config.ts), so its workers start without pdfjs.
 */
export async function importPdfjs(): Promise<PdfJs> {
  // With the worker module on globalThis, pdfjs runs its fake worker on this thread instead of
  // starting a nested Worker, which the tool worker and the VS Code webview CSP cannot do.
  // The worker module would attach itself to the tool worker's `self` on import; the
  // pdfjs-worker-module build plugin (scripts/vite) turns that off.
  const scope = globalThis as { pdfjsWorker?: unknown };

  // @ts-expect-error pdfjs-dist ships no types for its worker module.
  scope.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');

  return import('pdfjs-dist/legacy/build/pdf.mjs');
}
