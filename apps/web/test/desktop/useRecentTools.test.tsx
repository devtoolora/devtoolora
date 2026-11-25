// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRecentTools } from '../../src/features/desktop/hooks/useRecentTools';
import { blockedStorage } from '../blockedStorage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useRecentTools', () => {
  it('has the stored tools on the first render', async () => {
    const renders: string[][] = [];

    function Probe() {
      renders.push(useRecentTools().recentIds);

      return null;
    }

    localStorage.setItem('devtoolora-desktop-recent', JSON.stringify(['slugify', 'base64-decode']));

    const root = createRoot(document.createElement('div'));

    await act(async () => root.render(<Probe />));

    expect(renders[0]).toEqual(['slugify', 'base64-encode']);

    await act(async () => root.unmount());
  });

  it('remembers and clears in memory when local storage is blocked', async () => {
    vi.stubGlobal('localStorage', blockedStorage());

    const state: { current?: ReturnType<typeof useRecentTools> } = {};

    function Probe() {
      state.current = useRecentTools();

      return null;
    }

    const root = createRoot(document.createElement('div'));

    await act(async () => root.render(<Probe />));
    await act(async () => state.current?.remember('slugify'));

    expect(state.current?.recentIds).toEqual(['slugify']);

    await act(async () => state.current?.clear());

    expect(state.current?.recentIds).toEqual([]);

    await act(async () => root.unmount());
  });
});
