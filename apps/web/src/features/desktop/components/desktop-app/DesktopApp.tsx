import type { SerializedToolDefinition } from '@devtoolora/core';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useFavorites } from '@/features/tools';
import type { WebToolMetadata } from '@/toolMetadata';
import { webToolAliases, webToolMetadata } from '@/toolMetadata.generated';
import styles from './DesktopApp.module.scss';
import type { DesktopThemeMode } from '../../utils/desktopSettings';
import { DesktopSettingsModal } from '../desktop-settings-modal';
import { DesktopSidebar } from '../desktop-sidebar';
import { DesktopToolbar } from '../desktop-toolbar';
import { DesktopToolPanel } from '../desktop-tool-panel';
import { useDesktopSettings } from '../../hooks/useDesktopSettings';
import { usePrefersLight } from '../../hooks/usePrefersLight';
import { useRecentTools } from '../../hooks/useRecentTools';

function toolsById(ids: string[]): WebToolMetadata[] {
  return ids
    .map((id) => webToolMetadata.find((tool) => tool.id === id))
    .filter((tool): tool is WebToolMetadata => Boolean(tool));
}

function selectDesktopTool(slug: string | null, recentIds: string[]): WebToolMetadata {
  const requestedTool = [...webToolMetadata, ...webToolAliases].find((tool) => tool.slug === slug);
  const recentTool = toolsById(recentIds)[0];

  const fallbackTool = webToolMetadata.find((tool) => tool.id === 'json-format');
  const tool = requestedTool ?? recentTool ?? fallbackTool;

  if (!tool) throw new Error('JSON Format tool metadata is missing.');

  return tool;
}

function isLightThemeActive(themeMode: DesktopThemeMode, prefersLight: boolean): boolean {
  return themeMode === 'light' || (themeMode === 'system' && prefersLight);
}

function useDesktopToolSelection(recent: ReturnType<typeof useRecentTools>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTool = selectDesktopTool(searchParams.get('tool'), recent.recentIds);

  useEffect(() => {
    if (searchParams.get('tool') !== selectedTool.slug) {
      setSearchParams({ tool: selectedTool.slug }, { replace: true });
    }
  }, [searchParams, selectedTool.slug, setSearchParams]);

  const openTool = useCallback(
    (tool: WebToolMetadata) => {
      setSearchParams({ tool: tool.slug });
      recent.remember(tool.id);
    },
    [recent, setSearchParams],
  );

  return { openTool, selectedTool };
}

export function DesktopApp() {
  const favorites = useFavorites();
  const recent = useRecentTools();
  const { resetAppearance, settings, updateSetting } = useDesktopSettings();
  const isDesktopLight = isLightThemeActive(settings.themeMode, usePrefersLight());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [definition, setDefinition] = useState<SerializedToolDefinition>();
  const { openTool, selectedTool } = useDesktopToolSelection(recent);

  // A stable callback: ToolWorkspace reports the definition from an effect that depends on it.
  const handleDefinitionLoad = useCallback(
    (tool?: SerializedToolDefinition) => setDefinition(tool),
    [],
  );

  const handleThemeToggle = () => updateSetting('themeMode', isDesktopLight ? 'dark' : 'light');
  const handleSettingsOpen = () => setIsSettingsOpen(true);
  const handleSettingsClose = () => setIsSettingsOpen(false);
  const handleFavoriteToggle = () => favorites.onFavoriteToggle(selectedTool.id);

  const favoriteTools = webToolMetadata.filter((tool) => favorites.favoriteIds.has(tool.id));

  return (
    <main className={styles.desktopApp}>
      <DesktopToolbar
        isLightTheme={isDesktopLight}
        onSettingsOpen={handleSettingsOpen}
        onThemeToggle={handleThemeToggle}
        onToolOpen={openTool}
      />

      <DesktopSidebar
        favoriteTools={favoriteTools}
        recentTools={toolsById(recent.recentIds)}
        selectedTool={selectedTool}
        showRecent={settings.showRecent}
        onToolOpen={openTool}
      />

      <DesktopToolPanel
        continueWith={toolsById(definition?.relatedToolIds ?? [])}
        definition={definition}
        isFavorite={favorites.favoriteIds.has(selectedTool.aliasOf ?? selectedTool.id)}
        tool={selectedTool}
        onDefinitionLoad={handleDefinitionLoad}
        onFavoriteToggle={handleFavoriteToggle}
        onToolOpen={openTool}
      />

      <DesktopSettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClearRecent={recent.clear}
        onClose={handleSettingsClose}
        onResetAppearance={resetAppearance}
        onUpdateSetting={updateSetting}
      />
    </main>
  );
}
