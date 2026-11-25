import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { serviceWorkerSource } from '../../scripts/vite/service-worker';

type Listener = (event: Record<string, unknown>) => void;

// Runs the shipped source in an empty context, so any reference outside the function fails.
function startWorker(precache: string[], fetch?: (request: unknown) => Promise<Response>) {
  const listeners = new Map<string, Listener>();
  const added: string[] = [];
  const stored: string[] = [];
  const takeovers: string[] = [];
  const cache = {
    add: async (url: string) => void added.push(url),
    put: async (request: { url: string }) => void stored.push(request.url),
  };
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    clients: { claim: async () => void takeovers.push('claim') },
    location: { origin: 'https://example.test' },
    skipWaiting: async () => void takeovers.push('skipWaiting'),
  };

  runInNewContext(serviceWorkerSource(precache, 'abc123def456'), {
    URL,
    caches: {
      delete: async (key: string) => void takeovers.push(`delete ${key}`),
      keys: async () => ['devtoolora-old', 'devtoolora-abc123def456'],
      match: async () => undefined,
      open: async () => cache,
    },
    fetch,
    self,
  });

  return { added, listeners, stored, takeovers };
}

describe('service worker source', () => {
  it('precaches the app shell under the versioned cache name', async () => {
    const { added, listeners } = startWorker(['/', '/tools']);
    const pending: Promise<unknown>[] = [];

    listeners.get('install')?.({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);

    assert.deepEqual(added, ['/', '/tools']);
    assert.match(serviceWorkerSource([], 'abc123def456'), /"devtoolora-abc123def456"/);
  });

  it('waits for old tabs to close before taking over', async () => {
    const { listeners, takeovers } = startWorker(['/']);
    const pending: Promise<unknown>[] = [];
    const waitUntil = (promise: Promise<unknown>) => pending.push(promise);

    listeners.get('install')?.({ waitUntil });
    listeners.get('activate')?.({ waitUntil });
    await Promise.all(pending);

    assert.deepEqual(takeovers, ['delete devtoolora-old', 'claim']);
  });

  it('ignores cross-origin and non-GET requests', () => {
    const { listeners } = startWorker([]);
    let responded = false;
    const respondWith = () => (responded = true);

    listeners.get('fetch')?.({
      request: { method: 'POST', url: 'https://example.test/' },
      respondWith,
    });

    listeners.get('fetch')?.({
      request: { method: 'GET', url: 'https://cdn.test/a.js' },
      respondWith,
    });

    assert.equal(responded, false);
  });

  it('caches only complete successful responses', async () => {
    const statuses: Record<string, number> = { '/a.wasm': 200, '/b.wasm': 206, '/c.wasm': 404 };
    const { listeners, stored } = startWorker([], async (request) => {
      const status = statuses[new URL((request as { url: string }).url).pathname] ?? 500;

      return new Response(status === 206 || status === 200 ? 'x' : null, { status });
    });
    const responses: Promise<unknown>[] = [];

    for (const path of Object.keys(statuses))
      listeners.get('fetch')?.({
        request: { method: 'GET', mode: 'cors', url: `https://example.test${path}` },
        respondWith: (response: Promise<unknown>) => responses.push(response),
      });

    await Promise.all(responses);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(stored, ['https://example.test/a.wasm']);
  });
});
