type CatalogNavigationState = {
  catalogHref?: string;
};

const scrollKey = (href: string) => `dev-tools-catalog-scroll:${href}`;

export function rememberCatalogScroll(href: string): void {
  try {
    sessionStorage.setItem(scrollKey(href), String(window.scrollY));
  } catch {
    // Storage blocked: the catalog opens at the top.
  }
}

export function restoreCatalogScroll(href: string): void {
  let stored: string | null = null;

  try {
    stored = sessionStorage.getItem(scrollKey(href));
    sessionStorage.removeItem(scrollKey(href));
  } catch {
    // Storage blocked: nothing to restore.
  }

  if (!stored) return;

  requestAnimationFrame(() => window.scrollTo({ top: Number(stored) || 0 }));
}

export function catalogOrigin(state: unknown): string {
  if (!state || typeof state !== 'object' || !('catalogHref' in state)) return '/tools';

  const href = (state as CatalogNavigationState).catalogHref;

  return typeof href === 'string' && href.startsWith('/tools') ? href : '/tools';
}
