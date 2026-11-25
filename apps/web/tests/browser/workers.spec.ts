import { expect, test, type Page } from './fixtures';
import { webToolAliases, webToolMetadata } from '../../src/toolMetadata.generated';

const allToolCount = webToolMetadata.length + webToolAliases.length;

async function workerAssetUrl(page: Page): Promise<string> {
  const serviceWorker = await (await page.request.get('/sw.js')).text();
  const match = serviceWorker.match(/\/assets\/worker-[\w-]+\.js/);

  if (!match) throw new Error('The service worker does not precache the tool worker.');

  return match[0];
}

test('runs image tools in a real browser worker', async ({ page }) => {
  await page.goto('/');
  const workerUrl = await workerAssetUrl(page);

  const smoke = await page.evaluate(async (workerUrl) => {
    type SvgRenderRequest = {
      height: number;
      id?: undefined;
      port: MessagePort;
      source: string;
      type: 'renderSvg';
      width: number;
    };
    type WorkerResponse =
      | { id: string; ok: true; tools: Array<{ id: string }>; type: 'listTools' }
      | { id: string; ok: true; result: ToolResult; type: 'runTool' }
      | { error: string; id: string; ok: false };
    type ToolResult = {
      artifact?: { base64: string; fileName: string; mimeType: string };
      batch?: { succeeded: number; total: number };
      previewDataUri?: string;
      text: string;
    };

    const worker = new Worker(new URL(workerUrl, location.href), { type: 'module' });
    const pending = new Map<
      string,
      { reject(error: Error): void; resolve(response: WorkerResponse): void }
    >();
    let nextId = 0;

    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      pending.get(event.data.id)?.resolve(event.data);
      pending.delete(event.data.id);
    });

    // What the tool runner does for a worker: svg-to-png asks the page to draw.
    worker.addEventListener(
      'message',
      async ({ data }: MessageEvent<SvgRenderRequest | WorkerResponse>) => {
        if (!('type' in data) || data.type !== 'renderSvg') return;

        const image = new Image();

        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.source)}`;
        await image.decode();
        const canvas = new OffscreenCanvas(data.width, data.height);

        canvas.getContext('2d')?.drawImage(image, 0, 0, data.width, data.height);
        const blob = await canvas.convertToBlob({ type: 'image/png' });

        data.port.postMessage({ bytes: new Uint8Array(await blob.arrayBuffer()) });
      },
    );

    worker.addEventListener('error', (event) => {
      for (const [id, request] of pending) {
        request.reject(new Error(`Worker error before ${id}: ${event.message}`));
      }

      pending.clear();
    });

    worker.addEventListener('messageerror', () => {
      for (const [id, request] of pending) {
        request.reject(new Error(`Worker messageerror before ${id}`));
      }

      pending.clear();
    });

    function assert(condition: unknown, message: string): asserts condition {
      if (!condition) {
        throw new Error(message);
      }
    }

    async function request(message: Omit<Record<string, unknown>, 'id'>): Promise<WorkerResponse> {
      const id = `smoke-${(nextId += 1)}`;

      worker.postMessage({ id, ...message });

      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Worker did not respond to ${id}`));
        }, 60_000);

        pending.set(id, {
          reject,
          resolve: (response) => {
            window.clearTimeout(timer);
            resolve(response);
          },
        });
      });
    }

    async function runTool(
      toolId: string,
      text = '',
      fields: Record<string, string> = {},
    ): Promise<ToolResult> {
      const response = await request({ type: 'runTool', toolId, text, fields });

      if (!response.ok) {
        throw new Error(`${toolId}: ${response.error}`);
      }

      assert(response.type === 'runTool', `${toolId}: expected runTool response`);

      return response.result;
    }

    function dataUri(mimeType: string, base64: string): string {
      return `data:${mimeType};base64,${base64}`;
    }

    function requireArtifact(
      result: ToolResult,
      mimeType?: string,
    ): { base64: string; fileName: string; mimeType: string } {
      assert(result.artifact, 'Expected artifact');

      if (mimeType) {
        assert(
          result.artifact.mimeType === mimeType,
          `Expected ${mimeType}, got ${result.artifact.mimeType}`,
        );
      }

      assert(result.artifact.base64.length > 0, 'Expected non-empty artifact');

      return result.artifact;
    }

    function assertZip(result: ToolResult): void {
      const artifact = requireArtifact(result, 'application/zip');

      assert(atob(artifact.base64).startsWith('PK'), `${artifact.fileName} should be a ZIP`);
    }

    async function samplePng(): Promise<string> {
      const canvas = document.createElement('canvas');

      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext('2d');

      assert(context, 'Expected 2D canvas context');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 16, 16);
      context.fillStyle = '#2563eb';
      context.fillRect(2, 2, 12, 12);
      context.fillStyle = '#111827';
      context.fillRect(6, 6, 4, 4);

      return canvas.toDataURL('image/png');
    }

    const listResponse = await request({ type: 'listTools' });

    assert(listResponse.ok && listResponse.type === 'listTools', 'Expected listTools response');

    const ascii = await runTool('ascii-text-generator', 'Hi', { font: 'Standard' });

    assert(
      /_   _/.test(ascii.text),
      'ascii-text-generator should lazy-load the selected FIGlet font',
    );

    const png = await samplePng();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="#fff"/><circle cx="24" cy="16" r="10" fill="#2563eb"/></svg>';
    const svgPng = await runTool('svg-to-png', svg, { width: '48', height: '32' });

    requireArtifact(svgPng, 'image/png');

    const metadata = JSON.parse(
      (
        await runTool('image-tools', '', {
          image: png,
          imageName: 'sample.png',
          operation: 'metadata',
        })
      ).text,
    );

    assert(
      metadata.file.width === 16 && metadata.file.height === 16,
      'image-tools metadata should read PNG dimensions',
    );

    const resized = await runTool('image-tools', '', {
      image: png,
      imageName: 'sample.png',
      operation: 'transform',
      width: '8',
      height: '8',
      keepAspect: 'false',
      format: 'png',
    });

    requireArtifact(resized, 'image/png');

    const stripped = await runTool('exif-remover', '', { image: png, imageName: 'sample.png' });

    requireArtifact(stripped, 'image/png');

    const diff = JSON.parse(
      (await runTool('pixel-diff', '', { beforeImage: png, afterImage: png, threshold: '0' })).text,
    );

    assert(diff.changedPixels === 0, 'pixel-diff should report no changes for identical PNGs');

    assertZip(
      await runTool('web-pwa-icon-generator', '', {
        sourceMode: 'text',
        textLabel: 'T',
        textForeground: '#ffffff',
        textBackground: '#2563eb',
        appName: 'Smoke App',
      }),
    );

    const files = JSON.stringify([
      { name: 'one.png', data: png },
      { name: 'two.png', data: png },
    ]);
    const batch = await runTool('batch-image-tools', '', {
      images: files,
      width: '8',
      height: '8',
      format: 'png',
      contactSheet: 'false',
    });

    assert(
      batch.batch?.total === 2 && batch.batch.succeeded === 2,
      'batch-image-tools should process both PNGs',
    );

    assertZip(batch);

    const qr = await runTool('qr-code-generator', 'browser-smoke-qr', {
      format: 'svg',
      size: '192',
    });
    const qrPng = await runTool('svg-to-png', qr.text, { width: '192', height: '192' });
    const qrArtifact = requireArtifact(qrPng, 'image/png');
    const decoded = JSON.parse(
      (
        await runTool('qr-code-reader', '', {
          image: dataUri(qrArtifact.mimeType, qrArtifact.base64),
        })
      ).text,
    );

    assert(
      decoded.data === 'browser-smoke-qr',
      'qr-code-reader should decode the generated QR PNG',
    );

    worker.terminate();

    return {
      decoded: decoded.data,
      toolCount: listResponse.tools.length,
    };
  }, workerUrl);

  expect(smoke).toEqual({ decoded: 'browser-smoke-qr', toolCount: allToolCount });
});

test('runs the PWA worker and default FIGlet font offline', async ({ page, context }) => {
  await page.goto('/');

  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service worker support is required for the PWA offline smoke.');
    }

    await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      });
    }
  });

  const workerUrl = await workerAssetUrl(page);

  try {
    expect(await page.evaluate(async (url) => (await caches.match(url))?.ok, workerUrl)).toBe(true);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const smoke = await page.evaluate(async (workerUrl) => {
      type WorkerResponse =
        | { id: string; ok: true; tools: Array<{ id: string }>; type: 'listTools' }
        | { id: string; ok: true; result: { text: string }; type: 'runTool' }
        | { error: string; id: string; ok: false };

      const worker = new Worker(new URL(workerUrl, location.href), { type: 'module' });
      const pending = new Map<
        string,
        { reject(error: Error): void; resolve(response: WorkerResponse): void }
      >();
      let nextId = 0;

      worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
        pending.get(event.data.id)?.resolve(event.data);
        pending.delete(event.data.id);
      });

      worker.addEventListener('error', (event) => {
        for (const request of pending.values()) {
          request.reject(
            new Error(
              event.message || `Worker error loading ${event.filename || 'module dependencies'}`,
            ),
          );
        }

        pending.clear();
      });

      function request(message: Omit<Record<string, unknown>, 'id'>): Promise<WorkerResponse> {
        const id = `offline-smoke-${(nextId += 1)}`;

        worker.postMessage({ id, ...message });

        return new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Worker did not respond to ${id}`));
          }, 60_000);

          pending.set(id, {
            reject,
            resolve: (response) => {
              window.clearTimeout(timer);
              resolve(response);
            },
          });
        });
      }

      const list = await request({ type: 'listTools' });
      const ascii = await request({
        type: 'runTool',
        toolId: 'ascii-text-generator',
        text: 'Hi',
        fields: { font: 'Standard' },
      });

      worker.terminate();

      if (!list.ok || list.type !== 'listTools') {
        throw new Error('Offline worker did not list tools.');
      }

      if (!ascii.ok || ascii.type !== 'runTool') {
        throw new Error(ascii.ok ? 'Offline worker did not run the tool.' : ascii.error);
      }

      return {
        asciiOk: /_   _/.test(ascii.result.text),
        toolCount: list.tools.length,
      };
    }, workerUrl);

    expect(smoke).toEqual({ asciiOk: true, toolCount: allToolCount });
  } finally {
    await context.setOffline(false);
  }
});
