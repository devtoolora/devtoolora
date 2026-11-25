// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createRoutesStub } from 'react-router';
import ToolDetailRoute from '../src/routes/tool-detail';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Build-time only: the eager catalog does not load in jsdom.
vi.mock('../src/routes/toolGuide.server', () => ({ toolGuide: () => null }));

// A worker that never answers: the page must not wait for it to show the texts.
vi.mock('../src/lib/toolRunnerHost', () => ({
  webToolRunnerHost: {
    createWorker: () =>
      Object.assign(new EventTarget(), {
        postMessage: () => undefined,
        terminate: () => undefined,
      }),
  },
}));

describe('ToolDetailRoute', () => {
  it('loads the guide and FAQ on a client navigation without prerendered data', async () => {
    const Stub = createRoutesStub([
      { Component: ToolDetailRoute, loader: () => ({ guide: null }), path: '/tools/:slug' },
    ]);
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => root.render(<Stub initialEntries={['/tools/json-format']} />));

    await vi.waitFor(
      async () => {
        await act(async () => undefined);
        assert.match(container.textContent ?? '', /Questions about JSON Format/);
      },
      { timeout: 5000 },
    );

    assert.match(container.textContent ?? '', /sort keys/i);

    await act(async () => root.unmount());
  });
});
