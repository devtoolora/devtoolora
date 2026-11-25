import { useSyncExternalStore } from 'react';

const query = '(prefers-color-scheme: light)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(query);

  media.addEventListener('change', onChange);

  return () => media.removeEventListener('change', onChange);
}

/** The OS color scheme, kept current while the app is open; the prerender assumes dark. */
export function usePrefersLight(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
