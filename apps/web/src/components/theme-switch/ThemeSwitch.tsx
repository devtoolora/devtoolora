import { Moon, Sun } from 'lucide-react';
import type { JSX } from 'react';
import styles from './ThemeSwitch.module.scss';

export interface ThemeSwitchProps {
  isLightTheme: boolean;
  onToggle(): void;
}

export function ThemeSwitch({ isLightTheme, onToggle }: ThemeSwitchProps): JSX.Element {
  return (
    <button
      aria-checked={isLightTheme}
      aria-label="Light theme"
      className={styles.themeSwitch}
      role="switch"
      title="Light theme"
      type="button"
      onClick={onToggle}
    >
      <span aria-hidden="true" className={styles.themeSwitchTrack}>
        <span className={`${styles.themeSwitchThumb} ${isLightTheme ? 'is-light' : 'is-dark'}`}>
          {isLightTheme ? (
            <Sun aria-hidden="true" size={11} strokeWidth={2.4} />
          ) : (
            <Moon aria-hidden="true" size={11} strokeWidth={2.4} />
          )}
        </span>
      </span>
    </button>
  );
}
