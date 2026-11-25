import type React from 'react';
import { Outlet } from 'react-router';
import { AppFooter, AppHeader } from '@components';
import { useTheme } from '@/features/theme';
import styles from './site-layout.module.scss';

export default function SiteLayout(): React.JSX.Element {
  const theme = useTheme();

  return (
    <div className={styles.toolsShell}>
      <AppHeader {...theme} />
      <Outlet />
      <AppFooter />
    </div>
  );
}
