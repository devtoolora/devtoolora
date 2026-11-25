// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyDesktopTheme,
  customColorMode,
  DEFAULT_DESKTOP_SETTINGS,
  DESKTOP_THEME_PRESETS,
  type DesktopSettings,
} from '../../src/features/desktop/utils/desktopSettings';

const settings = (overrides: Partial<DesktopSettings>): DesktopSettings => ({
  ...DEFAULT_DESKTOP_SETTINGS,
  ...overrides,
});
const root = document.documentElement;
const voidToken = () => root.style.getPropertyValue('--color-void');

beforeEach(() => {
  root.removeAttribute('style');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

describe('applyDesktopTheme', () => {
  it.each(DESKTOP_THEME_PRESETS.filter(({ id }) => id !== 'midnight' && id !== 'glass'))(
    'gives $id its own color in both modes',
    ({ colors, id }) => {
      applyDesktopTheme(settings({ presetId: id, themeMode: 'light' }));
      expect(root.dataset.theme).toBe('light');
      expect(voidToken()).toBe(colors.light);

      applyDesktopTheme(settings({ presetId: id, themeMode: 'dark' }));
      expect(root.dataset.theme).toBe('dark');
      expect(voidToken()).toBe(colors.dark);
    },
  );

  it('leaves midnight to the base palette and clears earlier overrides', () => {
    applyDesktopTheme(settings({ presetId: 'slate', themeMode: 'dark' }));
    applyDesktopTheme(settings({ presetId: 'midnight', themeMode: 'light' }));

    expect(root.dataset.theme).toBe('light');
    expect(voidToken()).toBe('');
  });

  it('turns the glass surface on only for the glass preset', () => {
    applyDesktopTheme(settings({ presetId: 'slate', themeMode: 'light' }));
    applyDesktopTheme(settings({ presetId: 'glass', themeMode: 'light' }));

    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.surface).toBe('glass');
    expect(voidToken()).toBe('');

    applyDesktopTheme(settings({ presetId: 'slate', themeMode: 'light' }));
    expect(root.dataset.surface).toBeUndefined();
  });

  it('shows a custom color as picked in its own mode and as a tint in the other', () => {
    const custom = settings({ customBgColor: '#102040', presetId: 'custom' });

    applyDesktopTheme({ ...custom, themeMode: 'dark' });
    expect(voidToken()).toBe('#102040');

    applyDesktopTheme({ ...custom, themeMode: 'light' });
    expect(root.dataset.theme).toBe('light');
    expect(voidToken()).toBe('#e7e9ec');
  });

  it('follows the system mode', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    applyDesktopTheme(settings({ presetId: 'forest', themeMode: 'system' }));

    expect(root.dataset.theme).toBe('light');
  });
});

describe('customColorMode', () => {
  it('picks the mode whose text stays readable', () => {
    expect(customColorMode('#000000')).toBe('dark');
    expect(customColorMode('#808080')).toBe('light');
    expect(customColorMode('#ffffff')).toBe('light');
  });
});
