import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { vscodeToolMetadata } from '../../apps/vscode/src/extension/toolMetadata.generated';
import { ZipEntry } from '../../apps/vscode/release/packageVerification';

export function archiveEntries(paths: readonly string[]): ZipEntry[] {
  return paths.map((path) => ({
    compressedSize: 0,
    compressionMethod: 0,
    localHeaderOffset: 0,
    path,
    uncompressedSize: 0,
  }));
}

// The measured entry plus 10 %; a new tool lands in its domain chunk, never here.
export const WORKER_ENTRY_BUDGET = 120_000;
// A domain that nears this splits into two domain modules; the budget is never raised.
export const WORKER_CHUNK_BUDGET = 400_000;
// Entry plus every domain chunk and the static chunks they share, FIGlet fonts excluded.
export const WORKER_TOTAL_BUDGET = 3_000_000;

export function readBuiltWebWorker(): string {
  return readFileSync(builtWebWorkerPath(), 'utf8');
}

export function builtWebWorkerPath(): string {
  const webRoot = join(process.cwd(), 'out/web');

  for (const path of listFiles(webRoot)) {
    if (!path.endsWith('.js')) {
      continue;
    }

    const source = readFileSync(path, 'utf8');

    if (
      source.includes('browserWorker') &&
      source.includes('listTools') &&
      source.includes('getTool') &&
      source.includes('postMessage')
    ) {
      return path;
    }
  }

  assert.fail('Built browser worker was not found.');
}

export function readPreloadedScripts(htmlPath: string): string {
  const webRoot = join(process.cwd(), 'out/web');
  const html = readFileSync(htmlPath, 'utf8');

  return [...html.matchAll(/rel="modulepreload" href="\/assets\/([^"]+\.js)"/g)]
    .map((match) => readFileSync(join(webRoot, 'assets', match[1]!), 'utf8'))
    .join('\n');
}

export function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export type WorkerResponse = {
  error: string;
  id: unknown;
  ok: boolean;
  result: { text: string };
  tool: { aliasOf: string; id: string };
  tools: Array<{ id: string }>;
  type: string;
};

export function createWorkerHarness(): {
  dispose(): Promise<number>;
  post(message: Record<string, unknown>): Promise<WorkerResponse>;
} {
  const bootstrap = `import { parentPort, workerData } from 'node:worker_threads';
    let listener; const pending = [];
    globalThis.self = {
      addEventListener: (_type, callback) => { listener = callback; pending.splice(0).forEach(data => listener({ data })); },
      postMessage: data => parentPort.postMessage(data)
    };
    parentPort.on('message', data => listener ? listener({ data }) : pending.push(data));
    await import(workerData.moduleUrl);`;
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), {
    workerData: {
      moduleUrl: pathToFileURL(builtWebWorkerPath()).href,
    },
  });

  return {
    dispose: () => worker.terminate(),
    post: (message: Record<string, unknown>): Promise<WorkerResponse> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Worker did not respond to ${String(message.id)}`));
        }, 5000);

        function cleanup(): void {
          clearTimeout(timer);
          worker.off('message', handleMessage);
          worker.off('error', handleError);
        }

        function handleMessage(response: WorkerResponse): void {
          if (response.id !== message.id) return;

          cleanup();
          resolve(response);
        }

        function handleError(error: Error): void {
          cleanup();
          reject(error);
        }

        worker.on('message', handleMessage);
        worker.once('error', handleError);
        worker.postMessage(message);
      }),
  };
}

export const SAMPLE_CERTIFICATE: string =
  vscodeToolMetadata.find((tool) => tool.id === 'certificate-inspector')?.samples?.[0]?.text ?? '';

/** Whether a minified chunk defines a tool; Rolldown's minifier writes strings as templates. */
export function hasToolId(source: string, id: string): boolean {
  return source.includes(`id:"${id}"`) || source.includes(`id:\`${id}\``);
}

/** Chunk files a built module loads statically: `from"./x.js"` and the bare `import"./x.js"`. */
export function staticChunkImports(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map(
    (match) => match[1] ?? '',
  );
}
