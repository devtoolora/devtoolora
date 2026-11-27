import { ExternalLink, Menu, X } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { GITHUB_URL } from '@/lib/siteLinks';
import { Brand } from '../brand';
import { ThemeSwitch } from '../theme-switch';
import styles from './AppHeader.module.scss';

export interface AppHeaderProps {
  isLightTheme: boolean;
  onToggleTheme(): void;
}

interface NavItem {
  label: string;
  to: string;
}

interface MobileMenu {
  isOpen: boolean;
  onClose(): void;
  onToggle(): void;
}

interface MobileNavToggleProps {
  isOpen: boolean;
  onToggle(): void;
}

interface MobileNavDrawerProps {
  onNavigate(): void;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tools', to: '/tools' },
  { label: 'Extension', to: '/extension' },
  { label: 'About', to: '/about' },
];

function useMobileMenu(): MobileMenu {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = (): void => {
    setIsOpen((open) => !open);
  };

  const handleClose = (): void => {
    setIsOpen(false);
  };

  return { isOpen, onClose: handleClose, onToggle: handleToggle };
}

function DesktopNav(): JSX.Element {
  return (
    <nav aria-label="Main navigation" className={styles.desktopNav}>
      {NAV_ITEMS.map(({ label, to }) => (
        <NavLink key={to} to={to}>
          {label}
        </NavLink>
      ))}
      <a href={GITHUB_URL} rel="noreferrer" target="_blank">
        GitHub
        <ExternalLink aria-hidden="true" size={12} />
      </a>
    </nav>
  );
}

function MobileNavToggle({ isOpen, onToggle }: MobileNavToggleProps): JSX.Element {
  return (
    <button
      aria-controls="mobile-nav-drawer"
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      className={styles.mobileNavToggle}
      type="button"
      onClick={onToggle}
    >
      {isOpen ? (
        <X aria-hidden="true" size={20} strokeWidth={2} />
      ) : (
        <Menu aria-hidden="true" size={20} strokeWidth={2} />
      )}
    </button>
  );
}

function MobileNavDrawer({ onNavigate }: MobileNavDrawerProps): JSX.Element {
  return (
    <div className={styles.mobileNavDrawer} id="mobile-nav-drawer">
      <nav aria-label="Mobile navigation" className={styles.mobileNavLinks}>
        {NAV_ITEMS.map(({ label, to }) => (
          <NavLink
            className={({ isActive }) => (isActive ? 'is-active' : '')}
            key={to}
            to={to}
            onClick={onNavigate}
          >
            {label}
          </NavLink>
        ))}
        <a
          className={styles.mobileNavExternal}
          href={GITHUB_URL}
          rel="noreferrer"
          target="_blank"
          onClick={onNavigate}
        >
          <span>GitHub</span>
          <ExternalLink aria-hidden="true" size={13} />
        </a>
      </nav>
    </div>
  );
}

export function AppHeader({ isLightTheme, onToggleTheme }: AppHeaderProps): JSX.Element {
  const mobileMenu = useMobileMenu();

  return (
    <header className={`${styles.siteHeader} page-frame`}>
      <Brand />

      <DesktopNav />

      <div className={styles.actions}>
        <ThemeSwitch isLightTheme={isLightTheme} onToggle={onToggleTheme} />

        <MobileNavToggle isOpen={mobileMenu.isOpen} onToggle={mobileMenu.onToggle} />
      </div>

      {mobileMenu.isOpen && <MobileNavDrawer onNavigate={mobileMenu.onClose} />}
    </header>
  );
}
