import { useIsHydrated } from './useIsHydrated';

const applePlatform = /Mac|iPhone|iPad|iPod/;

export function useSearchShortcutLabel(): string {
  const isHydrated = useIsHydrated();

  return isHydrated && !applePlatform.test(navigator.userAgent) ? 'Ctrl K' : '⌘ K';
}
