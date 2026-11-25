import type { ToolRunnerHost } from '@devtoolora/tool-ui';
import toolWorkerUrl from '../worker.ts?worker&url';

const runtimePath = `${import.meta.env.BASE_URL}assets/runtime/`;

const fetchRuntimeFile: NonNullable<ToolRunnerHost['fetchRuntimeFile']> = async (
  _runtime,
  name,
  onProgress,
) => {
  const offline = new Error(`Could not load ${name} (offline).`);
  const response = await fetch(`${runtimePath}${name}`).catch(() => Promise.reject(offline));

  if (!response.ok) throw new Error(`Could not load ${name} (${response.status}).`);

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

  // A connection dropped mid-download rejects the read.
  return new Response(body).arrayBuffer().catch(() => Promise.reject(offline));
};

export const webToolRunnerHost: ToolRunnerHost = {
  createRuntimeWorker: () => Promise.resolve(new Worker(toolWorkerUrl, { type: 'module' })),
  createWorker: () => new Worker(toolWorkerUrl, { type: 'module' }),
  fetchRuntimeFile,
  // Prerendering has no location; the worker only needs the URL in the browser.
  runtimeScriptBaseUrl:
    typeof window === 'undefined' ? undefined : new URL(runtimePath, window.location.href).href,
  runtimeSource: 'download',
};

export const desktopToolRunnerHost: ToolRunnerHost = {
  ...webToolRunnerHost,
  runtimeSource: 'bundled',
};
