import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Runs in the browser: serviceWorkerSource ships this function's text, so it may only use its
// parameters and service worker globals.
function serviceWorker(cacheName: string, appShell: string[]): void {
  const worker = self as unknown as ServiceWorkerGlobalScope;

  function cacheCopy(request: Request, response: Response): Response {
    // A 404 or a partial 206 (wasm range requests) must never be served from the cache forever.
    if (!response.ok || response.status !== 200) return response;

    const copy = response.clone();

    void caches.open(cacheName).then((cache) => cache.put(request, copy));

    return response;
  }

  // No skipWaiting: open tabs keep their hashed chunks until every tab closes.
  worker.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(cacheName)
        .then((cache) => Promise.allSettled(appShell.map((url) => cache.add(url)))),
    );
  });

  worker.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))),
        )
        // Without skipWaiting no old tab is left, so claim only takes pages from the first visit.
        .then(() => worker.clients.claim()),
    );
  });

  worker.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET' || new URL(request.url).origin !== worker.location.origin) return;

    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then((response) => cacheCopy(request, response))
          .catch(() =>
            caches
              .match(request, { ignoreVary: true })
              .then((cached) => cached ?? caches.match('/__spa-fallback.html'))
              .then((cached) => cached ?? Response.error()),
          ),
      );

      return;
    }

    event.respondWith(
      caches
        .match(request, { ignoreVary: true })
        .then(
          (cached) => cached ?? fetch(request).then((response) => cacheCopy(request, response)),
        ),
    );
  });
}

export function serviceWorkerSource(precache: string[], cacheVersion: string): string {
  const cacheName = JSON.stringify(`devtoolora-${cacheVersion}`);

  return `(${serviceWorker.toString()})(${cacheName}, ${JSON.stringify(precache)});\n`;
}

export function writeServiceWorker(
  outDir: string,
  shellPages: string[],
  isPrecachedAsset: (file: string) => boolean,
): void {
  const assets = readdirSync(join(outDir, 'assets'))
    .filter((file) => /\.(css|m?js)$/.test(file) && isPrecachedAsset(file))
    .sort()
    .map((file) => `/assets/${file}`);
  const precache = [
    ...shellPages,
    // The fetch handler serves this shell for every page not visited yet while offline.
    '/__spa-fallback.html',
    '/manifest.webmanifest',
    ...assets,
  ];
  const cacheHash = createHash('sha256');

  for (const url of precache) {
    const candidate = url === '/' ? join(outDir, 'index.html') : join(outDir, url.slice(1));
    const filePath = statSync(candidate).isDirectory() ? join(candidate, 'index.html') : candidate;

    cacheHash.update(url).update(readFileSync(filePath));
  }

  writeFileSync(
    join(outDir, 'sw.js'),
    serviceWorkerSource(precache, cacheHash.digest('hex').slice(0, 12)),
  );
}
