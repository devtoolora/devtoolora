import { useCallback, useEffect, useState } from 'react';
import { webToolAliases } from '@/toolMetadata.generated';

const storageKey = 'dev-tools-favorites';

function canonicalToolId(id: string): string {
  return webToolAliases.find((tool) => tool.id === id)?.aliasOf ?? id;
}

function parseFavorites(value: string | null): Set<string> {
  try {
    const stored: unknown = JSON.parse(value ?? '[]');

    return Array.isArray(stored)
      ? new Set(stored.filter((id) => typeof id === 'string').map(canonicalToolId))
      : new Set();
  } catch {
    return new Set();
  }
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setFavoriteIds(parseFavorites(localStorage.getItem(storageKey)));
    } catch {
      // Storage blocked: favorites live in memory for this page.
    }

    // Another tab changed its favorites.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setFavoriteIds(parseFavorites(event.newValue));
    };

    window.addEventListener('storage', handleStorage);

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleFavoriteToggle = useCallback((toolId: string) => {
    const canonicalId = canonicalToolId(toolId);

    setFavoriteIds((current) => {
      const next = new Set(current);

      if (next.has(canonicalId)) next.delete(canonicalId);
      else next.add(canonicalId);

      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Storage blocked: keep the in-memory state.
      }

      return next;
    });
  }, []);

  return { favoriteIds, onFavoriteToggle: handleFavoriteToggle };
}
