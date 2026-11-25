// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { pdfWorkerScriptUrl } from '../src/tool-runner/previews/pdf-pages-preview/pdfThumbnails';

const created: Blob[] = [];

URL.createObjectURL = (blob: Blob) => {
  created.push(blob);

  return `blob:worker-${created.length}`;
};

describe('pdfWorkerScriptUrl', () => {
  it('serves the fetched script as a JavaScript blob so blob-only worker CSPs accept it', async () => {
    globalThis.fetch = async () =>
      ({ arrayBuffer: async () => new TextEncoder().encode('x').buffer, ok: true }) as Response;

    assert.equal(await pdfWorkerScriptUrl('https://app.local/pdf.worker.mjs'), 'blob:worker-1');
    assert.equal(created[0]?.type, 'text/javascript');
  });

  it('falls back to the original url when the script cannot be fetched (desktop connect-src)', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    assert.equal(
      await pdfWorkerScriptUrl('https://app.local/pdf.worker.mjs'),
      'https://app.local/pdf.worker.mjs',
    );

    globalThis.fetch = async () => ({ ok: false, status: 404 }) as Response;

    assert.equal(
      await pdfWorkerScriptUrl('https://app.local/pdf.worker.mjs'),
      'https://app.local/pdf.worker.mjs',
    );
  });
});
