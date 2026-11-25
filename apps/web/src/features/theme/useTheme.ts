import { useLayoutEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dev-tools-theme';

function readCurrentTheme(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === 'light') {
      return true;
    }

    if (stored === 'dark') {
      return false;
    }
  } catch {}

  return document.documentElement.dataset.theme === 'light';
}

let isLight = readCurrentTheme();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function clearDesktopInlineStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const style = document.documentElement.style;

  style.removeProperty('--color-void');
  style.removeProperty('--color-surface');
  style.removeProperty('--color-surface-strong');
  style.removeProperty('--color-line');
  style.removeProperty('--color-line-soft');
  style.removeProperty('--color-text');
  style.removeProperty('--color-muted');
  style.removeProperty('--color-shadow');
}

function applyThemeDom(next: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const theme = next ? 'light' : 'dark';

  document.documentElement.dataset.theme = theme;
  clearDesktopInlineStyles();
  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute('content', next ? '#f2f6f8' : '#0b172d');
  }
}

function setTheme(next: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  isLight = next;
  const theme = next ? 'light' : 'dark';

  applyThemeDom(next);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}

  notify();
}

function toggleTheme(): void {
  setTheme(!isLight);
}

if (typeof window !== 'undefined') {
  applyThemeDom(isLight);

  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      const next = event.newValue === 'light';

      if (next !== isLight) {
        isLight = next;
        applyThemeDom(next);
        notify();
      }
    }
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): boolean {
  return isLight;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useTheme() {
  const isLightTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // A hydration error re-renders <html> and drops the theme the pre-paint script set on it.
  useLayoutEffect(() => {
    applyThemeDom(getSnapshot());
  }, []);

  return {
    isLightTheme,
    onToggleTheme: toggleTheme,
  };
}
