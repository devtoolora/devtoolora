import { useEffect, useState, useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(query).matches;

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};

  const preference = window.matchMedia(query);

  preference.addEventListener('change', onChange);

  return () => preference.removeEventListener('change', onChange);
}

// Prerendered HTML is always playing, so hydration reads the server snapshot (false) and applies
// the real preference right after; fresh client mounts read it on the first render.
export function usePlaybackPaused(): [boolean, (paused: boolean) => void] {
  const reduced = useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
  const [override, setOverride] = useState<boolean>();

  useEffect(() => {
    if (reduced) setOverride(undefined);
  }, [reduced]);

  return [override ?? reduced, setOverride];
}
