import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFWorker } from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

export type PdfThumbnail = { height: number; page: number; url: string; width: number };

export type PdfThumbnailState = {
  error: string;
  pageCount: number;
  pages: PdfThumbnail[];
  stale: boolean;
  status: 'error' | 'idle' | 'loading' | 'ready';
};

type PdfThumbnailOptions = { keepPrevious?: boolean; limit: number; width: number };

const idle: PdfThumbnailState = {
  error: '',
  pageCount: 0,
  pages: [],
  stale: false,
  status: 'idle',
};

let pdfJs: Promise<{ lib: PdfJs; worker: PDFWorker }> | undefined;

/**
 * The VS Code webview CSP allows workers only from blob:, so the script is fetched and re-served as
 * JavaScript.
 * Where the fetch itself is blocked (the desktop CSP has no same-origin connect-src) the direct URL
 * still works.
 */
export async function pdfWorkerScriptUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) return url;

    return URL.createObjectURL(
      new Blob([await response.arrayBuffer()], { type: 'text/javascript' }),
    );
  } catch {
    return url;
  }
}

/**
 * pdf.js loads only when a PDF preview is shown; the legacy build also runs in older Safari and the
 * macOS WebView.
 */
function loadPdfJs(): Promise<{ lib: PdfJs; worker: PDFWorker }> {
  if (!pdfJs) {
    pdfJs = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(async ([lib, workerUrl]) => {
      lib.GlobalWorkerOptions.workerSrc = await pdfWorkerScriptUrl(workerUrl.default);

      return { lib, worker: new lib.PDFWorker() };
    });

    pdfJs.catch(() => {
      pdfJs = undefined;
    });
  }

  return pdfJs;
}

function dataUriBytes(data: string): Uint8Array {
  const comma = data.indexOf(',');
  const body = data.slice(comma + 1);

  if (!data.slice(0, comma).includes(';base64'))
    return new TextEncoder().encode(decodeURIComponent(body));

  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

  return bytes;
}

async function renderThumbnail(
  pdf: PDFDocumentProxy,
  number: number,
  width: number,
): Promise<PdfThumbnail> {
  const page = await pdf.getPage(number);

  try {
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (width * Math.min(2, window.devicePixelRatio || 1)) / natural.width,
    });
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );

    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('The page preview could not be encoded.');

    return {
      height: natural.height,
      page: number,
      url: URL.createObjectURL(blob),
      width: natural.width,
    };
  } finally {
    page.cleanup();
  }
}

function thumbnailError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';

  if (name === 'PasswordException')
    return 'This PDF is password protected, so its pages cannot be previewed.';
  if (name === 'InvalidPDFException')
    return 'This file could not be read as a PDF, so there is nothing to preview.';

  return 'Page previews are not available here. Typed page numbers still work.';
}

type ThumbnailJob = { cancelled: boolean; task?: { destroy(): Promise<void> } };

async function renderDocument(
  data: string,
  { keepPrevious = false, limit, width }: PdfThumbnailOptions,
  job: ThumbnailJob,
  show: (state: PdfThumbnailState) => void,
): Promise<void> {
  const { lib, worker } = await loadPdfJs();

  if (job.cancelled) return;

  const loading = lib.getDocument({
    data: dataUriBytes(data),
    verbosity: lib.VerbosityLevel.ERRORS,
    worker,
  });

  job.task = loading;
  const pdf = await loading.promise;
  const pages: PdfThumbnail[] = [];

  if (!pdf.numPages || !keepPrevious)
    show({ ...idle, pageCount: pdf.numPages, status: pdf.numPages ? 'loading' : 'ready' });

  for (let number = 1; number <= Math.min(pdf.numPages, limit); number += 1) {
    const thumbnail = await renderThumbnail(pdf, number, width);

    if (job.cancelled) {
      URL.revokeObjectURL(thumbnail.url);

      return;
    }

    pages.push(thumbnail);

    show({
      error: '',
      pageCount: pdf.numPages,
      pages: [...pages],
      stale: false,
      status: pages.length === Math.min(pdf.numPages, limit) ? 'ready' : 'loading',
    });
  }
}

export function usePdfThumbnails(
  data: string | undefined,
  options: PdfThumbnailOptions,
): PdfThumbnailState {
  const { keepPrevious = false, limit, width } = options;
  const [state, setState] = useState<PdfThumbnailState>(idle);
  const shown = useRef<PdfThumbnail[]>([]);

  const show = useCallback((next: PdfThumbnailState) => {
    for (const thumbnail of shown.current) {
      if (!next.pages.includes(thumbnail)) URL.revokeObjectURL(thumbnail.url);
    }

    shown.current = next.pages;
    setState(next);
  }, []);

  useEffect(
    () => () => {
      for (const thumbnail of shown.current) URL.revokeObjectURL(thumbnail.url);
      shown.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!data) {
      if (keepPrevious)
        setState((current) => ({ ...current, stale: current.pages.length > 0, status: 'idle' }));
      else show(idle);

      return;
    }

    const job: ThumbnailJob = { cancelled: false };

    if (keepPrevious)
      setState((current) => ({
        ...current,
        error: '',
        stale: current.pages.length > 0,
        status: 'loading',
      }));
    else show({ ...idle, status: 'loading' });

    renderDocument(data, { keepPrevious, limit, width }, job, show).catch((error: unknown) => {
      if (!job.cancelled) show({ ...idle, error: thumbnailError(error), status: 'error' });
    });

    return () => {
      job.cancelled = true;
      void job.task?.destroy();
    };
  }, [data, keepPrevious, limit, show, width]);

  return state;
}
