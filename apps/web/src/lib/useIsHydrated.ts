import { useSyncExternalStore } from 'react';

const subscribeNever = (): (() => void) => () => {};

// Gates browser-only output: rendering it while hydrating would mismatch and make React re-render
// the whole document.
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
