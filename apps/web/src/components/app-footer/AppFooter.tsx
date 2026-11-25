import type React from 'react';
import { Link } from 'react-router';
import { GITHUB_URL, ISSUES_URL, LICENSES_URL } from '@/lib/siteLinks';
import { Brand } from '../brand';
import styles from './AppFooter.module.scss';

type AppFooterVariant = 'home' | 'page';

export interface AppFooterProps {
  variant?: AppFooterVariant;
}

const footerVariantClasses: Record<AppFooterVariant, string | undefined> = {
  home: styles.home,
  page: undefined,
};

export function AppFooter({ variant = 'page' }: AppFooterProps): React.JSX.Element {
  const footerClassName = [styles.footer, footerVariantClasses[variant], 'site-footer']
    .filter(Boolean)
    .join(' ');

  return (
    <footer className={footerClassName}>
      <div className={`${styles.layout} page-frame`}>
        <Brand />

        <p>
          Local developer utilities for focused work.
          <br />
          Fast. Private. Always available.
        </p>

        <nav aria-label="Footer navigation">
          <Link to="/about">About</Link>
          <a href={GITHUB_URL} rel="noreferrer" target="_blank">
            GitHub
          </a>
          <a href={ISSUES_URL} rel="noreferrer" target="_blank">
            Contact
          </a>
          <a href={LICENSES_URL} rel="noreferrer" target="_blank">
            Licenses
          </a>
        </nav>
      </div>
    </footer>
  );
}
