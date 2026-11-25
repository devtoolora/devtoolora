import { describe, expect, it } from 'vitest';
import { runtimeFilesPlugin } from '../../scripts/vite/runtime-files';

type Handler = (
  request: { url?: string },
  response: {
    end(body?: string | Uint8Array): void;
    setHeader(name: string, value: string): void;
    statusCode: number;
  },
) => void;

function devRequest(url: string) {
  let handler: Handler | undefined;
  let route = '';
  const plugin = runtimeFilesPlugin({ outDir: 'assets' });
  const server = {
    config: { base: '/' },
    middlewares: {
      use(path: string, middleware: Handler) {
        route = path;
        handler = middleware;
      },
    },
  };

  (plugin.configureServer as unknown as (value: typeof server) => void)(server);

  const headers = new Map<string, string>();
  const reply = { body: undefined as string | Uint8Array | undefined, headers, route, status: 200 };

  handler?.(
    { url },
    {
      end: (body) => {
        reply.body = body;
      },
      setHeader: (name, value) => headers.set(name, value),
      set statusCode(value: number) {
        reply.status = value;
      },
    },
  );

  return reply;
}

describe('runtimeFilesPlugin dev server', () => {
  it('serves the manifest under the runtime path instead of the SPA fallback', () => {
    const reply = devRequest('/runtime-manifest.json?v=1');
    const manifest = JSON.parse(String(reply.body)) as Record<string, { source?: string }[]>;

    expect(reply.route).toBe('/assets/runtime');
    expect(reply.status).toBe(200);
    expect(Object.keys(manifest).sort()).toEqual(['heic', 'ocr']);
    expect(manifest.ocr![0]!.source).toBeUndefined();
  });

  it('serves glue as a script so the module worker can import it', () => {
    const reply = devRequest('/libheif.js');

    expect(reply.headers.get('Content-Type')).toBe('text/javascript');
    expect((reply.body as Uint8Array).byteLength).toBeGreaterThan(0);
  });

  it('answers 404 for anything outside the runtime file list', () => {
    expect(devRequest('/../package.json').status).toBe(404);
    expect(devRequest('/missing.wasm').status).toBe(404);
  });
});
