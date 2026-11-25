import { useCallback, useEffect, useState } from 'react';
import {
  applyDesktopTheme,
  DesktopSettings,
  loadDesktopSettings,
  saveDesktopSettings,
} from '../utils/desktopSettings';
import { syncWindowGlass } from '../utils/desktopWindowGlass';

export function useDesktopSettings() {
  const [settings, setSettings] = useState<DesktopSettings>(loadDesktopSettings);

  useEffect(() => {
    applyDesktopTheme(settings);
    syncWindowGlass(settings);
    saveDesktopSettings(settings);

    const media = window.matchMedia('(prefers-color-scheme: light)');

    const handleMediaChange = () => {
      if (settings.themeMode === 'system') {
        applyDesktopTheme(settings);
        syncWindowGlass(settings);
      }
    };

    media.addEventListener('change', handleMediaChange);

    return () => media.removeEventListener('change', handleMediaChange);
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  const resetAppearance = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      presetId: 'midnight',
      customBgColor: null,
    }));
  }, []);

  return {
    settings,
    updateSetting,
    resetAppearance,
  };
}
