import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.css', '.html', '.js', '.json', '.svg', '.webmanifest']);

function resolveFile(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const target = join(root, decoded, extname(decoded) === '' ? 'index.html' : '');

  if (relative(root, target).startsWith('..') || !existsSync(target)) return null;

  return statSync(target).isFile() ? target : null;
}

function respond(request, response, file) {
  const extension = extname(file);
  const headers = { 'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream' };
  let body = readFileSync(file);

  if (COMPRESSIBLE.has(extension) && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '')) {
    body = gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
  }

  response.writeHead(200, headers);
  response.end(body);
}

export function serveStatic(root, port) {
  const absoluteRoot = resolve(root);
  const server = createServer((request, response) => {
    const file = resolveFile(
      absoluteRoot,
      new URL(request.url ?? '/', 'http://localhost').pathname,
    );

    if (file === null) {
      response.writeHead(404);
      response.end('Not found');

      return;
    }

    respond(request, response, file);
  });

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);

    server.listen(port, '127.0.0.1', () => {
      resolvePromise({
        close: () =>
          new Promise((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}
