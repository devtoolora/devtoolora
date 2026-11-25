import { isTauri } from '@tauri-apps/api/core';
import { Effect, EffectState, getCurrentWindow } from '@tauri-apps/api/window';
import {
  type DesktopResolvedMode,
  type DesktopSettings,
  resolveDesktopMode,
} from './desktopSettings';

/** Only the macOS window is created transparent (tauri.macos.conf.json). */
function canSeeThroughWindow(): boolean {
  return isTauri() && navigator.userAgent.includes('Mac');
}

// macOS 26 and newer draw Liquid Glass; older versions fall back to the vibrancy material.
async function applyWindowGlass(isGlass: boolean, mode: DesktopResolvedMode): Promise<void> {
  const window = getCurrentWindow();

  await window.setTheme(mode);

  if (!isGlass) {
    await window.clearEffects();

    return;
  }

  await window.setEffects({
    effects: [Effect.LiquidGlassRegular, Effect.UnderWindowBackground],
    state: EffectState.Active,
  });
}

export function syncWindowGlass(settings: DesktopSettings): void {
  if (!canSeeThroughWindow()) return;

  const root = document.documentElement;
  const isGlass = settings.presetId === 'glass';

  if (isGlass) root.dataset.window = 'see-through';
  else delete root.dataset.window;

  applyWindowGlass(isGlass, resolveDesktopMode(settings)).catch(() => {
    delete root.dataset.window;
  });
}
