import { Check, CloudOff, LockKeyhole, Moon, RotateCcw, Sun, Trash2, Zap } from 'lucide-react';
import { Badge, Button } from '@components';
import {
  DESKTOP_THEME_PRESETS,
  type DesktopSettings,
  type DesktopThemeMode,
  type DesktopThemePresetId,
} from '../../utils/desktopSettings';
import styles from './DesktopSettingsModal.module.scss';
import { selectWithArrowKeys } from './selectWithArrowKeys';

const THEME_MODES: DesktopThemeMode[] = ['system', 'dark', 'light'];
const DEFAULT_CUSTOM_COLOR = '#0b172d';
const PRESET_IDS = DESKTOP_THEME_PRESETS.map(({ id }) => id);

const themeModeLabels: Record<DesktopThemeMode, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

interface AppearancePanelProps {
  customHexInput: string;
  settings: DesktopSettings;
  onCustomColorBlur(): void;
  onCustomColorChange(hex: string): void;
  onPresetSelect(presetId: DesktopThemePresetId): void;
  onReset(): void;
  onThemeModeChange(mode: DesktopThemeMode): void;
}

interface SidebarPanelProps {
  isRecentCleared: boolean;
  showRecent: boolean;
  onRecentClear(): void;
  onShowRecentChange(showRecent: boolean): void;
}

interface ThemeModeIconProps {
  mode: DesktopThemeMode;
}

interface ThemeModeGroupProps {
  themeMode: DesktopThemeMode;
  onThemeModeChange(mode: DesktopThemeMode): void;
}

interface ThemePresetGridProps {
  presetId: DesktopThemePresetId;
  onPresetSelect(presetId: DesktopThemePresetId): void;
}

interface CustomColorControlProps {
  customBgColor: string | null;
  customHexInput: string;
  onCustomColorBlur(): void;
  onCustomColorChange(hex: string): void;
}

function ThemeModeIcon({ mode }: ThemeModeIconProps) {
  return (
    <>
      {mode === 'system' && <Zap aria-hidden="true" size={14} />}
      {mode === 'dark' && <Moon aria-hidden="true" size={14} />}
      {mode === 'light' && <Sun aria-hidden="true" size={14} />}
    </>
  );
}

function ThemeModeGroup({ themeMode, onThemeModeChange }: ThemeModeGroupProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) =>
    selectWithArrowKeys(event, THEME_MODES, themeMode, onThemeModeChange);

  return (
    <div className={styles.sectionGroup}>
      <span className={styles.groupTitle}>Mode</span>
      <div
        aria-label="Mode"
        className={styles.pillGroup}
        role="radiogroup"
        onKeyDown={handleKeyDown}
      >
        {THEME_MODES.map((mode) => (
          <button
            aria-checked={themeMode === mode}
            className={styles.pillButton}
            key={mode}
            role="radio"
            tabIndex={themeMode === mode ? 0 : -1}
            type="button"
            onClick={() => onThemeModeChange(mode)}
          >
            <ThemeModeIcon mode={mode} />
            <span>{themeModeLabels[mode]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemePresetGrid({ presetId, onPresetSelect }: ThemePresetGridProps) {
  const focusablePresetId = PRESET_IDS.includes(presetId) ? presetId : PRESET_IDS[0];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) =>
    selectWithArrowKeys(event, PRESET_IDS, presetId, onPresetSelect);

  return (
    <div className={styles.sectionGroup}>
      <span className={styles.groupTitle}>Color themes</span>
      <div
        aria-label="Color themes"
        className={styles.presetsGrid}
        role="radiogroup"
        onKeyDown={handleKeyDown}
      >
        {DESKTOP_THEME_PRESETS.map((preset) => {
          const isActive = presetId === preset.id;

          return (
            <button
              aria-checked={isActive}
              className={styles.presetCard}
              key={preset.id}
              role="radio"
              tabIndex={preset.id === focusablePresetId ? 0 : -1}
              type="button"
              onClick={() => onPresetSelect(preset.id)}
            >
              <div className={styles.presetCardTop}>
                <span
                  aria-hidden="true"
                  className={styles.presetSwatch}
                  style={{
                    background: `linear-gradient(135deg, ${preset.colors.dark} 50%, ${preset.colors.light} 50%)`,
                  }}
                />
                {isActive && <Check aria-hidden="true" color="var(--color-signal)" size={14} />}
              </div>
              <strong>{preset.label}</strong>
              <small>{preset.description}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomColorControl({
  customBgColor,
  customHexInput,
  onCustomColorBlur,
  onCustomColorChange,
}: CustomColorControlProps) {
  return (
    <div className={styles.sectionGroup}>
      <span className={styles.groupTitle}>Custom background</span>
      <div className={styles.customColorControl}>
        <div className={styles.colorInputWrapper}>
          <input
            aria-label="Pick a custom color"
            type="color"
            value={customBgColor ?? DEFAULT_CUSTOM_COLOR}
            onChange={(e) => onCustomColorChange(e.target.value)}
          />
        </div>
        <div className={styles.customColorText}>
          <strong>Your color</strong>
          <small>Surfaces, borders and text adjust to keep the contrast readable.</small>
        </div>
        <input
          aria-label="Custom color hex code"
          className={styles.hexInput}
          maxLength={7}
          placeholder={DEFAULT_CUSTOM_COLOR.toUpperCase()}
          type="text"
          value={customHexInput}
          onBlur={onCustomColorBlur}
          onChange={(e) => onCustomColorChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function AppearancePanel({
  customHexInput,
  settings,
  onCustomColorBlur,
  onCustomColorChange,
  onPresetSelect,
  onReset,
  onThemeModeChange,
}: AppearancePanelProps) {
  return (
    <>
      <ThemeModeGroup themeMode={settings.themeMode} onThemeModeChange={onThemeModeChange} />

      <ThemePresetGrid presetId={settings.presetId} onPresetSelect={onPresetSelect} />

      <CustomColorControl
        customBgColor={settings.customBgColor}
        customHexInput={customHexInput}
        onCustomColorBlur={onCustomColorBlur}
        onCustomColorChange={onCustomColorChange}
      />

      <Button size="sm" variant="outline" onClick={onReset}>
        <RotateCcw aria-hidden="true" size={14} />
        Reset appearance
      </Button>
    </>
  );
}

export function SidebarPanel({
  isRecentCleared,
  showRecent,
  onRecentClear,
  onShowRecentChange,
}: SidebarPanelProps) {
  return (
    <>
      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>
          <strong>Show Recent</strong>
          <small>Lists the tools you opened last in the sidebar.</small>
        </div>
        <label className={styles.switch}>
          <input
            aria-label="Show recent tools in the sidebar"
            checked={showRecent}
            type="checkbox"
            onChange={(e) => onShowRecentChange(e.target.checked)}
          />
          <span aria-hidden="true" className={styles.switchSlider} />
        </label>
      </div>

      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>
          <strong>Recent tools</strong>
          <small>Forgets the last eight tools you opened.</small>
        </div>
        <Button size="sm" variant="outline" onClick={onRecentClear}>
          <Trash2 aria-hidden="true" size={14} />
          {isRecentCleared ? 'Cleared' : 'Clear recent tools'}
        </Button>
      </div>
    </>
  );
}

export function AboutPanel() {
  return (
    <div className={styles.aboutCard}>
      <strong>Dev Toolora Desktop v{__APP_VERSION__}</strong>
      <p>
        A local developer toolbox in a native Tauri shell. Every tool, including file work, runs on
        your computer.
      </p>
      <div className={styles.aboutBadges}>
        <Badge size="sm" variant="signal">
          <LockKeyhole aria-hidden="true" size={13} />
          100% Local-first
        </Badge>
        <Badge size="sm" variant="default">
          <CloudOff aria-hidden="true" size={13} />
          No network calls
        </Badge>
        <Badge size="sm" variant="calibration">
          <Zap aria-hidden="true" size={13} />
          Tauri v2 Native Shell
        </Badge>
      </div>
    </div>
  );
}
