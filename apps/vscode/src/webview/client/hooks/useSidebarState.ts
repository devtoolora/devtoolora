import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NavigationState, SidebarTool, WebviewConfig } from '../types';
import { getVscode, onHostMessage } from '../host/vscodeHost';

// The host's navigationState is the source of truth; it is saved so the next boot draws the last
// favorites and recents before the host answers webviewReady.
export function useSidebarState(tools: SidebarTool[], config: WebviewConfig) {
  const saved = useMemo(() => getVscode().getState() ?? {}, []);
  const [collapsedCategories, setCollapsedCategories] = useState(
    () => new Set(saved.collapsedCategories ?? []),
  );
  const [navigation, setNavigation] = useState<NavigationState>(() => ({
    activeToolId: config.initialActiveToolId ?? saved.activeToolId ?? tools[0]?.id ?? '',
    favoriteToolIds: saved.favoriteToolIds ?? [],
    recentTools: saved.recentTools ?? [],
  }));

  useEffect(() => {
    getVscode().setState({
      ...saved,
      ...navigation,
      collapsedCategories: Array.from(collapsedCategories),
    });
  }, [collapsedCategories, navigation, saved]);

  useEffect(
    () =>
      onHostMessage((message) => {
        if (message.type === 'navigationState') setNavigation(message.state);
      }),
    [],
  );

  useEffect(() => getVscode().postMessage({ type: 'webviewReady' }), []);

  const setCollapsed = useCallback((labels: string[], collapsed: boolean) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);

      for (const label of labels) {
        if (collapsed) next.add(label);
        else next.delete(label);
      }

      return next;
    });
  }, []);

  const toggleCollapsed = useCallback(
    (label: string) => {
      setCollapsed([label], !collapsedCategories.has(label));
    },
    [collapsedCategories, setCollapsed],
  );

  return { collapsedCategories, navigation, setCollapsed, toggleCollapsed };
}
