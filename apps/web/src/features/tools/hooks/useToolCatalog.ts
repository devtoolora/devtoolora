import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useIsHydrated } from '@/lib/useIsHydrated';
import type { WebToolMetadata } from '@/toolMetadata';

const noFilters = new URLSearchParams();

export function useToolCatalog(tools: WebToolMetadata[], favoriteIds: Set<string>) {
  const [currentParams, setSearchParams] = useSearchParams();
  // The prerendered /tools page has no query string; filtering during hydration would mismatch
  // and make React re-render the whole document, dropping the pre-paint theme on <html>.
  const isHydrated = useIsHydrated();
  const searchParams = isHydrated ? currentParams : noFilters;
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const favoritesOnly = searchParams.get('favorites') === '1';

  const filteredTools = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return tools.filter((tool) => {
      if (category && tool.category !== category) return false;
      if (favoritesOnly && !favoriteIds.has(tool.id)) return false;

      const haystack =
        `${tool.name} ${tool.description} ${tool.category} ${tool.keywords.join(' ')}`.toLowerCase();

      return words.every((word) => haystack.includes(word));
    });
  }, [category, favoriteIds, favoritesOnly, query, tools]);

  const update = (updates: Record<string, string | undefined>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        for (const [name, value] of Object.entries(updates)) {
          if (value) {
            next.set(name, value);
          } else {
            next.delete(name);
          }
        }

        return next;
      },
      { replace: true },
    );
  };

  return {
    query,
    category,
    favoritesOnly,
    filteredTools,
    onQueryChange: (value: string) => update({ q: value || undefined }),
    onCategoryChange: (value: string) =>
      update({ category: value || undefined, favorites: undefined }),
    onFavoritesOnlyChange: (value: boolean) =>
      update({ favorites: value ? '1' : undefined, category: undefined }),
  };
}
