import { Settings } from 'lucide-react';
import { BrandMark, ThemeSwitch } from '@components';
import type { WebToolMetadata } from '@/toolMetadata';
import styles from './DesktopToolbar.module.scss';
import { DesktopSearch } from '../desktop-search';

interface DesktopToolbarProps {
  isLightTheme: boolean;
  onSettingsOpen(): void;
  onThemeToggle(): void;
  onToolOpen(tool: WebToolMetadata): void;
}

export function DesktopToolbar({
  isLightTheme,
  onSettingsOpen,
  onThemeToggle,
  onToolOpen,
}: DesktopToolbarProps) {
  return (
    <header className={styles.toolbar} data-testid="desktop-toolbar">
      <div className={styles.brand} data-testid="desktop-brand">
        <BrandMark size="sm" />
        <strong>Dev Toolora</strong>
        <small>Desktop</small>
      </div>
      <DesktopSearch onToolOpen={onToolOpen} />
      <div className={styles.toolbarActions}>
        <ThemeSwitch isLightTheme={isLightTheme} onToggle={onThemeToggle} />
        <button
          aria-label="Desktop settings"
          className={styles.settingsButton}
          type="button"
          onClick={onSettingsOpen}
        >
          <Settings aria-hidden="true" size={17} />
        </button>
      </div>
    </header>
  );
}
