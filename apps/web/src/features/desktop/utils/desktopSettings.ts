export type DesktopThemeMode = 'system' | 'dark' | 'light';
export type DesktopThemePresetId =
  'midnight' | 'glass' | 'oled' | 'slate' | 'forest' | 'navy' | 'custom';

export type DesktopResolvedMode = Exclude<DesktopThemeMode, 'system'>;

export interface DesktopThemePreset {
  colors: Record<DesktopResolvedMode, string>;
  description: string;
  id: DesktopThemePresetId;
  label: string;
}

export interface DesktopSettings {
  customBgColor: string | null;
  presetId: DesktopThemePresetId;
  showRecent: boolean;
  themeMode: DesktopThemeMode;
}

export const DESKTOP_THEME_PRESETS: DesktopThemePreset[] = [
  {
    id: 'midnight',
    label: 'Signal Midnight',
    description: 'Deep blue by default, cool gray in light mode',
    colors: { dark: '#0b172d', light: '#f2f6f8' },
  },
  {
    id: 'glass',
    label: 'Liquid Glass',
    description: 'See-through panels over a color field',
    colors: { dark: '#0a1024', light: '#e9eefa' },
  },
  {
    id: 'oled',
    label: 'Pure Contrast',
    description: 'True black, true white in light mode',
    colors: { dark: '#000000', light: '#ffffff' },
  },
  {
    id: 'slate',
    label: 'Slate Graphite',
    description: 'A muted, neutral graphite',
    colors: { dark: '#121820', light: '#eceff3' },
  },
  {
    id: 'forest',
    label: 'Deep Forest',
    description: 'A quiet emerald',
    colors: { dark: '#091815', light: '#e8f3ee' },
  },
  {
    id: 'navy',
    label: 'Nordic Navy',
    description: 'A cold northern blue',
    colors: { dark: '#081424', light: '#e6eff8' },
  },
];

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  themeMode: 'system',
  presetId: 'midnight',
  customBgColor: null,
  showRecent: true,
};

const DESKTOP_SETTINGS_STORAGE_KEY = 'devtoolora-desktop-settings-v1';

export function parseHex(hex: string): { b: number; g: number; r: number } | null {
  const clean = hex.trim().replace(/^#/, '');

  if (clean.length === 3) {
    const r = parseInt(clean.charAt(0).repeat(2), 16);
    const g = parseInt(clean.charAt(1).repeat(2), 16);
    const b = parseInt(clean.charAt(2).repeat(2), 16);

    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }

  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);

    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }

  return null;
}

function getRelativeLuminance(hex: string): number {
  const rgb = parseHex(hex);

  if (!rgb) return 0;

  const sRGBtoLin = (color: number) => {
    const normalized = color / 255;

    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * sRGBtoLin(rgb.r) + 0.7152 * sRGBtoLin(rgb.g) + 0.0722 * sRGBtoLin(rgb.b);
}

export function loadDesktopSettings(): DesktopSettings {
  if (typeof window === 'undefined') return DEFAULT_DESKTOP_SETTINGS;

  try {
    const raw = localStorage.getItem(DESKTOP_SETTINGS_STORAGE_KEY);

    if (!raw) {
      const oldTheme = localStorage.getItem('dev-tools-theme');

      if (oldTheme === 'light' || oldTheme === 'dark' || oldTheme === 'system') {
        return { ...DEFAULT_DESKTOP_SETTINGS, themeMode: oldTheme };
      }

      return DEFAULT_DESKTOP_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<DesktopSettings>;

    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'system'
          ? parsed.themeMode
          : 'system',
      presetId: storedPresetId(parsed.presetId),
      customBgColor:
        typeof parsed.customBgColor === 'string' && parseHex(parsed.customBgColor)
          ? parsed.customBgColor
          : null,
      showRecent: typeof parsed.showRecent === 'boolean' ? parsed.showRecent : true,
    };
  } catch {
    return DEFAULT_DESKTOP_SETTINGS;
  }
}

export function saveDesktopSettings(settings: DesktopSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(DESKTOP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem('dev-tools-theme', settings.themeMode);
  } catch {
    // Storage can refuse writes in private mode.
  }
}

function storedPresetId(presetId: DesktopThemePresetId | undefined): DesktopThemePresetId {
  if (presetId && DESKTOP_THEME_PRESETS.some((preset) => preset.id === presetId)) return presetId;

  return presetId === 'custom' ? 'custom' : 'midnight';
}

function mixHex(hex: string, otherHex: string, weight: number): string {
  const color = parseHex(hex);
  const other = parseHex(otherHex);

  if (!color || !other) return hex;

  const channel = (from: number, to: number) =>
    Math.round(from * weight + to * (1 - weight))
      .toString(16)
      .padStart(2, '0');

  return `#${channel(color.r, other.r)}${channel(color.g, other.g)}${channel(color.b, other.b)}`;
}

export function customColorMode(hex: string): DesktopResolvedMode {
  return getRelativeLuminance(hex) > 0.18 ? 'light' : 'dark';
}

function customVoidColor(hex: string, mode: DesktopResolvedMode): string {
  if (customColorMode(hex) === mode) return hex;

  return mode === 'light' ? mixHex(hex, '#ffffff', 0.1) : mixHex(hex, '#0b0f14', 0.12);
}

function resolveVoidColor(settings: DesktopSettings, mode: DesktopResolvedMode): string {
  if (settings.presetId === 'custom' && settings.customBgColor) {
    return customVoidColor(settings.customBgColor, mode);
  }

  const preset =
    DESKTOP_THEME_PRESETS.find((candidate) => candidate.id === settings.presetId) ??
    DESKTOP_THEME_PRESETS[0];

  return preset?.colors[mode] ?? '#0b172d';
}

function setDerivedTokens(
  style: CSSStyleDeclaration,
  voidColor: string,
  mode: DesktopResolvedMode,
): void {
  const contrast = mode === 'light' ? 'black' : 'white';

  style.setProperty('--color-void', voidColor);
  style.setProperty('--color-line', `color-mix(in srgb, ${voidColor} 72%, ${contrast})`);
  style.setProperty('--color-line-soft', `color-mix(in srgb, ${voidColor} 85%, ${contrast})`);

  if (mode === 'light') {
    style.setProperty('--color-surface', `color-mix(in srgb, ${voidColor} 40%, white)`);
    style.setProperty('--color-surface-strong', `color-mix(in srgb, ${voidColor} 20%, white)`);
    style.setProperty('--color-text', '#081722');
    style.setProperty('--color-muted', '#475569');
    style.setProperty('--color-shadow', 'rgb(29 53 68 / 18%)');
  } else {
    style.setProperty('--color-surface', `color-mix(in srgb, ${voidColor} 93%, white)`);
    style.setProperty('--color-surface-strong', `color-mix(in srgb, ${voidColor} 89%, white)`);
    style.setProperty('--color-text', '#edf5ff');
    style.setProperty('--color-muted', '#9bb0c4');
    style.setProperty('--color-shadow', 'rgb(2 8 18 / 55%)');
  }
}

export function resolveDesktopMode(settings: DesktopSettings): DesktopResolvedMode {
  if (settings.themeMode !== 'system') return settings.themeMode;

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyDesktopTheme(settings: DesktopSettings): void {
  if (typeof document === 'undefined') return;

  const mode = resolveDesktopMode(settings);
  const root = document.documentElement;
  const voidColor = resolveVoidColor(settings, mode);

  root.dataset.theme = mode;

  if (settings.presetId === 'glass') root.dataset.surface = 'glass';
  else delete root.dataset.surface;

  // Midnight is the base.css palette and glass has its own stylesheet; neither needs overrides.
  if (settings.presetId === 'midnight' || settings.presetId === 'glass') {
    clearCustomTokens(root.style);
  } else {
    setDerivedTokens(root.style, voidColor, mode);
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', voidColor);
}

function clearCustomTokens(style: CSSStyleDeclaration): void {
  style.removeProperty('--color-void');
  style.removeProperty('--color-surface');
  style.removeProperty('--color-surface-strong');
  style.removeProperty('--color-line');
  style.removeProperty('--color-line-soft');
  style.removeProperty('--color-text');
  style.removeProperty('--color-muted');
  style.removeProperty('--color-shadow');
}
