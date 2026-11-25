import { useCallback, useState } from 'react';
import { webToolAliases, webToolMetadata } from '@/toolMetadata.generated';

const recentKey = 'devtoolora-desktop-recent';

function validStoredIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const knownIds = new Set(webToolMetadata.map((tool) => tool.id));
  const ids = value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => webToolAliases.find((tool) => tool.id === id)?.aliasOf ?? id);

  return [...new Set(ids.filter((id) => knownIds.has(id)))].slice(0, 8);
}

function readStoredIds(): string[] {
  try {
    return validStoredIds(JSON.parse(localStorage.getItem(recentKey) ?? '[]'));
  } catch {
    return [];
  }
}

export function useRecentTools() {
  // Read on the first render: the desktop picks its start tool from the recent list right away.
  const [recentIds, setRecentIds] = useState(readStoredIds);

  const remember = useCallback((toolId: string) => {
    setRecentIds((current) => {
      const next = [toolId, ...current.filter((id) => id !== toolId)].slice(0, 8);

      try {
        localStorage.setItem(recentKey, JSON.stringify(next));
      } catch {
        // Storage blocked: keep the in-memory list.
      }

      return next;
    });
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(recentKey);
    } catch {
      // Storage blocked: nothing was stored.
    }

    setRecentIds([]);
  }, []);

  return { clear, recentIds, remember };
}
