import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../../out/web', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('../../out', import.meta.url)),
  build: { outDir: 'web' },
  plugins: [
    {
      name: 'serve-prerendered-route-html',
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.method !== 'GET' || !request.headers.accept?.includes('text/html'))
            return next();

          const pathname = decodeURIComponent(
            new URL(request.url ?? '/', 'http://localhost').pathname,
          );

          if (pathname === '/' || pathname.includes('.')) return next();

          const candidate = join(webRoot, pathname, 'index.html');

          if (relative(webRoot, candidate).startsWith('..')) return next();

          const isPrerendered = existsSync(candidate);

          // Unknown routes get the SPA shell; the home page would fail hydration against them.
          response.statusCode = isPrerendered ? 200 : 404;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');

          response.end(
            readFileSync(isPrerendered ? candidate : join(webRoot, '__spa-fallback.html')),
          );
        });
      },
    },
  ],
});
