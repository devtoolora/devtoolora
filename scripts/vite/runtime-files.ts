import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
import { runtimeManifest } from '../../packages/functions/src/runtime/manifest.generated';

// The runtime packages are dependencies of the functions package, so resolve from there.
const require = createRequire(new URL('../../packages/functions/package.json', import.meta.url));
const licenses = ['tesseract.js-core/LICENSE', 'libheif-js/libheif-wasm/LICENSE'];

function noticesText(): string {
  const header = readFileSync(new URL('./runtime-notices.txt', import.meta.url), 'utf8');
  const texts = licenses.map(
    (license) => `\n\n===== ${license} =====\n\n${readFileSync(require.resolve(license), 'utf8')}`,
  );

  return header + texts.join('');
}

function manifestText(): string {
  const manifest = Object.fromEntries(
    Object.entries(runtimeManifest).map(([runtime, entries]) => [
      runtime,
      entries.map(({ source, ...entry }) => entry),
    ]),
  );

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const runtimeFiles = new Map<string, () => string | Uint8Array>([
  ...Object.values(runtimeManifest)
    .flat()
    .map((entry): [string, () => Uint8Array] => [
      entry.name,
      () => readFileSync(require.resolve(entry.source)),
    ]),
  ['runtime-manifest.json', manifestText],
  ['THIRD_PARTY_NOTICES.txt', noticesText],
]);

// Runtime files are copied byte for byte, never through the bundler. The dev server serves them
// itself, because its SPA fallback would answer that path with HTML.
export function runtimeFilesPlugin(options: { outDir: string }): Plugin {
  return {
    name: 'runtime-files',
    applyToEnvironment: (environment) => environment.name === 'client',
    configureServer(server) {
      server.middlewares.use(
        `${server.config.base}${options.outDir}/runtime`,
        (request, response) => {
          const name = new URL(request.url ?? '/', 'http://dev').pathname.slice(1);
          const read = runtimeFiles.get(name);

          if (!read) {
            response.statusCode = 404;
            response.end();

            return;
          }

          response.setHeader(
            'Content-Type',
            name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
          );

          response.end(read());
        },
      );
    },
    generateBundle() {
      for (const [name, read] of runtimeFiles)
        this.emitFile({
          fileName: `${options.outDir}/runtime/${name}`,
          source: read(),
          type: 'asset',
        });
    },
  };
}
