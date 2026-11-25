import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { lazyFigletFontsPlugin } from '../../scripts/vite/lazy-figlet-fonts';
import { pdfjsWorkerModulePlugin } from '../../scripts/vite/pdfjs-worker-module';
import { runtimeFilesPlugin } from '../../scripts/vite/runtime-files';

const extensionRoot = fileURLToPath(new URL('.', import.meta.url));
const webviewRoot = join(extensionRoot, 'src', 'webview', 'client');
const functionsPdfjs = join(extensionRoot, '../../packages/functions/src/pdf/pdfjs.ts');

// Bundled into worker.js, pdfjs (~1.7 MB) would be evaluated at every worker start; the host
// prepends the separate assets/pdfjs.js to the shared worker only.
function workerPdfjsLoaderPlugin(): Plugin {
  return {
    name: 'worker-pdfjs-loader',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('/pdfjs')) return undefined;

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });

      return resolved?.id === functionsPdfjs
        ? join(webviewRoot, 'pdfjs', 'importPdfjs.ts')
        : undefined;
    },
  };
}

// Classic scripts built after the main build, into its output: assets/<mode>.js.
const scriptEntries: Record<string, string> = {
  pdfjs: 'pdfjs/pdfjsScript.ts',
  worker: 'worker.ts',
};

export default defineConfig(({ mode }) => {
  const scriptEntry = scriptEntries[mode];
  const isScriptBuild = scriptEntry !== undefined;

  return {
    logLevel: 'warn',
    base: isScriptBuild ? '/' : './',
    root: webviewRoot,
    publicDir: false,
    plugins: [
      lazyFigletFontsPlugin(),
      pdfjsWorkerModulePlugin(),
      mode === 'worker' && workerPdfjsLoaderPlugin(),
      // Wasm runtimes and their glue ship unbundled in assets/runtime; the host fetches them.
      !isScriptBuild && runtimeFilesPlugin({ outDir: 'assets' }),
    ],
    build: {
      emptyOutDir: !isScriptBuild,
      modulePreload: isScriptBuild ? false : undefined,
      outDir: join(extensionRoot, 'dist', 'webview'),
      sourcemap: false,
      target: 'es2022',
      rolldownOptions: scriptEntry
        ? {
            input: join(webviewRoot, scriptEntry),
            output: {
              entryFileNames: `assets/${mode}.js`,
              format: 'iife',
            },
          }
        : {
            input: { main: join(webviewRoot, 'index.html') },
            output: {
              entryFileNames: 'assets/main.js',
              // The package gate requires assets/app.js and assets/sidebarApp.js: the lazily
              // imported React editor and sidebar are those chunks.
              chunkFileNames: (chunk) => {
                if (chunk.name === 'EditorApp') return 'assets/app.js';
                if (chunk.name === 'SidebarApp') return 'assets/sidebarApp.js';

                return 'assets/[name].js';
              },
              assetFileNames: (assetInfo) =>
                assetInfo.name === 'index.css' ? 'assets/main.css' : 'assets/[name][extname]',
              format: 'es',
            },
          },
    },
  };
});
