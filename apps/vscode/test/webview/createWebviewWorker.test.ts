// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { loadWorkerHost } from '../../src/webview/client/host/createWebviewWorker';

class RecordingWorker {
  static urls: string[] = [];

  constructor(url: string) {
    RecordingWorker.urls.push(url);
  }
}

const blobs: Blob[] = [];
const workerUri = 'https://webview.local/assets/worker.js';
const pdfjsUri = 'https://webview.local/assets/pdfjs.js';

(globalThis as { Worker: unknown }).Worker = RecordingWorker;

URL.createObjectURL = (blob: Blob) => {
  blobs.push(blob);

  return `blob:${blobs.length}`;
};

function serve(files: Record<string, string>): string[] {
  const fetched: string[] = [];

  globalThis.fetch = async (input) => {
    const body = files[String(input)];

    fetched.push(String(input));

    return {
      blob: async () => new Blob([body ?? '']),
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
    } as Response;
  };

  return fetched;
}

afterEach(() => {
  blobs.length = 0;
  RecordingWorker.urls = [];
});

describe('loadWorkerHost', () => {
  it('prepends pdfjs to the shared worker only and fetches each script once', async () => {
    const fetched = serve({ [pdfjsUri]: 'pdfjs();', [workerUri]: 'worker();' });
    const host = await loadWorkerHost(workerUri);

    host.createWorker();
    host.createWorker();
    host.createIsolatedWorker?.();
    assert.deepEqual(fetched.sort(), [pdfjsUri, workerUri]);
    assert.deepEqual(RecordingWorker.urls, ['blob:2', 'blob:2', 'blob:1']);

    assert.deepEqual(await Promise.all(blobs.map((blob) => blob.text())), [
      'worker();',
      'pdfjs();\nworker();',
    ]);
  });

  it('finds pdfjs.js next to a worker URI relative to the document', async () => {
    const fetched = serve({
      '/assets/worker.js': 'worker();',
      [new URL('/assets/pdfjs.js', location.href).href]: 'pdfjs();',
    });

    await loadWorkerHost('/assets/worker.js');
    assert.equal(fetched.length, 2);
    assert.equal(await blobs[1]?.text(), 'pdfjs();\nworker();');
  });

  it('starts every worker without pdfjs when pdfjs.js cannot be fetched', async () => {
    serve({ [workerUri]: 'worker();' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const host = await loadWorkerHost(workerUri);

    assert.equal(warn.mock.calls.length, 1);
    assert.match(String(warn.mock.calls[0]?.[0]), /PDF reader script failed to load/);
    warn.mockRestore();
    host.createWorker();
    host.createIsolatedWorker?.();
    assert.deepEqual(RecordingWorker.urls, ['blob:1', 'blob:1']);
    assert.equal(blobs.length, 1);
  });

  it('yields a host whose workers throw when the worker script cannot be fetched', async () => {
    serve({ [pdfjsUri]: 'pdfjs();' });
    const host = await loadWorkerHost(workerUri);
    const failure = { message: 'Tool worker failed to load (404).' };

    assert.throws(() => host.createWorker(), failure);
    assert.throws(() => host.createIsolatedWorker?.(), failure);
    const missing = await loadWorkerHost(undefined);

    assert.throws(() => missing.createWorker(), {
      message: 'Tool worker failed to load (no worker URI).',
    });
  });

  it('reports a runtime file whose body fails mid-download as a network error', async () => {
    serve({ [pdfjsUri]: 'pdfjs();', [workerUri]: 'worker();' });
    const host = await loadWorkerHost(workerUri);
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => controller.error(new TypeError('terminated')),
    });

    globalThis.fetch = async () => new Response(body);

    await assert.rejects(
      host.fetchRuntimeFile!('ocr', 'eng.traineddata.gzip', () => {}),
      {
        message: 'Could not load eng.traineddata.gzip (network error).',
      },
    );
  });
});
