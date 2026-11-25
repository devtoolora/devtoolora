// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFavorites } from '../src/features/tools/hooks/useFavorites';
import { blockedStorage } from './blockedStorage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function renderFavorites() {
  const state: { current?: ReturnType<typeof useFavorites> } = {};

  function Probe() {
    state.current = useFavorites();

    return null;
  }

  const root = createRoot(document.createElement('div'));

  await act(async () => root.render(<Probe />));

  return { root, state };
}

describe('useFavorites', () => {
  it('toggles in memory when local storage is blocked', async () => {
    vi.stubGlobal('localStorage', blockedStorage());

    const { root, state } = await renderFavorites();

    await act(async () => state.current?.onFavoriteToggle('json-format'));

    expect(state.current?.favoriteIds.has('json-format')).toBe(true);

    await act(async () => root.unmount());
  });

  it('picks up favorites saved in another tab', async () => {
    const { root, state } = await renderFavorites();

    await act(async () =>
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'dev-tools-favorites', newValue: '["json-format"]' }),
      ),
    );

    expect(state.current?.favoriteIds.has('json-format')).toBe(true);

    await act(async () => root.unmount());
  });
});
