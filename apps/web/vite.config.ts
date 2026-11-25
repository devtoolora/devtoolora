import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import {
  figletFontImports,
  figletFontNames,
  lazyFigletFontsPlugin,
} from '../../scripts/vite/lazy-figlet-fonts';
import { compressedToolGuidesPlugin } from '../../scripts/vite/compressed-tool-guides';
import { pdfjsWorkerModulePlugin } from '../../scripts/vite/pdfjs-worker-module';
import { runtimeFilesPlugin } from '../../scripts/vite/runtime-files';
import { webAliases } from '../../scripts/vite/web-aliases';
import { version } from './package.json';

export default defineConfig(({ command }) => ({
  logLevel: command === 'serve' ? 'info' : 'warn',
  root: import.meta.dirname,
  publicDir: 'public',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __SITE_URL__: JSON.stringify(
      process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : undefined,
    ),
  },
  plugins: [
    reactRouter(),
    lazyFigletFontsPlugin({ lazyStandard: true }),
    // Tool texts load on demand in the page; the prerendered HTML already carries them.
    compressedToolGuidesPlugin(),
    pdfjsWorkerModulePlugin(),
    // Wasm runtimes and their glue ship unbundled; the service worker caches them on first use.
    runtimeFilesPlugin({ outDir: 'assets' }),
  ],
  resolve: {
    alias: webAliases,
  },
  optimizeDeps: {
    // Pre-bundled deps skip plugin transforms; the pdfjs worker module must pass through one.
    exclude: [...figletFontImports, 'pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  worker: {
    format: 'es',
    plugins: () => [
      lazyFigletFontsPlugin({ lazyStandard: true }),
      compressedToolGuidesPlugin(),
      pdfjsWorkerModulePlugin(),
    ],
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        // FIGlet fonts keep stable names: the service worker excludes them by font name. Everything
        // else is hashed so a deploy never mixes an old entry with new chunks.
        chunkFileNames: (chunk) =>
          figletFontNames.includes(chunk.name) ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
}));
