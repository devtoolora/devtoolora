import type { ToolRuntime } from '@devtoolora/core';
import { runtimeManifest } from '@devtoolora/functions/runtime';
import type { ToolRunnerHost } from '@devtoolora/tool-ui';

type RuntimeHost = Required<Pick<ToolRunnerHost, 'createRuntimeWorker' | 'fetchRuntimeFile'>>;

async function fetchScript(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok) throw new Error(`Tool worker failed to load (${response.status}).`);

  return response.blob();
}

// Optional: without pdfjs.js only the PDF tools fail, with their own message.
async function fetchPdfjs(workerUri: string): Promise<Blob | undefined> {
  try {
    return await fetchScript(new URL('pdfjs.js', new URL(workerUri, location.href)).href);
  } catch (error) {
    console.warn('PDF reader script failed to load:', error);

    return undefined;
  }
}

const networkError = (name: string) => () =>
  Promise.reject(new Error(`Could not load ${name} (network error).`));

async function fetchRuntimeResponse(workerUri: string, name: string): Promise<Response> {
  const url = new URL(`runtime/${name}`, new URL(workerUri, location.href)).href;
  const response = await fetch(url).catch(networkError(name));

  if (!response.ok) throw new Error(`Could not load ${name} (${response.status}).`);

  return response;
}

// The unmodified glue runs before worker.js in one blob, so the worker finds the glue's global.
function runtimeHost(workerUri: string, worker: Blob): RuntimeHost {
  const workerUrls = new Map<ToolRuntime, Promise<string>>();

  const runtimeWorkerUrl = async (runtime: ToolRuntime): Promise<string> => {
    const glue = runtimeManifest[runtime].find((entry) => entry.kind === 'script');

    if (!glue) throw new Error(`The ${runtime} runtime has no script.`);

    const response = await fetchRuntimeResponse(workerUri, glue.name);
    const script = await response.blob().catch(networkError(glue.name));

    return URL.createObjectURL(new Blob([script, '\n', worker], { type: 'text/javascript' }));
  };

  return {
    createRuntimeWorker: async (runtime) => {
      let url = workerUrls.get(runtime);

      if (!url) {
        url = runtimeWorkerUrl(runtime);
        workerUrls.set(runtime, url);
        // A failed fetch is dropped so Retry fetches it again.
        url.catch(() => workerUrls.delete(runtime));
      }

      return new Worker(await url);
    },
    fetchRuntimeFile: async (_runtime, name, onProgress) => {
      const response = await fetchRuntimeResponse(workerUri, name);
      let loaded = 0;
      const body = response.body?.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            loaded += chunk.byteLength;
            onProgress(loaded);
            controller.enqueue(chunk);
          },
        }),
      );

      return new Response(body).arrayBuffer().catch(networkError(name));
    },
  };
}

// The webview CSP allows workers only from blob:, and VS Code serves extension files to the
// document, not to workers, so every worker starts from a blob of a script fetched here.
export async function loadWorkerHost(workerUri: string | undefined): Promise<ToolRunnerHost> {
  try {
    if (!workerUri) throw new Error('Tool worker failed to load (no worker URI).');

    const [worker, pdfjs] = await Promise.all([fetchScript(workerUri), fetchPdfjs(workerUri)]);
    const isolatedUrl = URL.createObjectURL(worker);
    const sharedUrl = pdfjs
      ? URL.createObjectURL(new Blob([pdfjs, '\n', worker], { type: 'text/javascript' }))
      : isolatedUrl;

    return {
      createIsolatedWorker: () => new Worker(isolatedUrl),
      createWorker: () => new Worker(sharedUrl),
      ...runtimeHost(workerUri, worker),
    };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));

    const createWorker = (): Worker => {
      throw failure;
    };

    return {
      createIsolatedWorker: createWorker,
      createRuntimeWorker: () => Promise.reject(failure),
      createWorker,
      fetchRuntimeFile: () => Promise.reject(failure),
    };
  }
}
