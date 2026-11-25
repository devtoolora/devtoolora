import type { Plugin } from 'vite';

const workerModuleSuffix = '/pdfjs-dist/legacy/build/pdf.worker.mjs';

// When evaluated in anything that looks like a worker, the pdfjs worker module attaches to `self`
// and takes over its message channel. Tool workers run pdfjs in-thread (globalThis.pdfjsWorker), so
// the guard is turned off at build time. The standalone pdf.worker.min.mjs keeps it.
const autoAttachGuard =
  'typeof window === "undefined" && !isNodeJS && typeof self !== "undefined" && typeof self.postMessage === "function" && "onmessage" in self';

export function pdfjsWorkerModulePlugin(): Plugin {
  return {
    name: 'pdfjs-worker-module',
    transform(code: string, id: string) {
      const [path = id, query = ''] = id.split('?');

      // ?url and ?raw imports are not evaluated as code, so the guard is irrelevant there.
      if (/(?:^|&)(?:url|raw)(?:&|$)/.test(query)) return undefined;

      if (!path.replaceAll('\\', '/').endsWith(workerModuleSuffix)) return undefined;

      // A pdfjs upgrade that rewrites the guard must fail the build, not silently hijack workers.
      if (!code.includes(autoAttachGuard))
        throw new Error(`pdfjs worker auto-attach guard not found in ${path}.`);

      return { code: code.replace(autoAttachGuard, 'false'), map: null };
    },
  };
}
