import type { MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { AppFooter, AppHeader } from '@components';
import { useTheme } from '@/features/theme';
import layoutStyles from './site-layout.module.scss';
import styles from './not-found.module.scss';

export const meta: MetaFunction = () => [
  { title: 'Page not found — Dev Toolora' },
  { name: 'robots', content: 'noindex' },
];

export default function NotFoundRoute() {
  const theme = useTheme();

  return (
    <div className={layoutStyles.toolsShell}>
      <AppHeader {...theme} />
      <main className={`${styles.notFound} page-frame`}>
        <p className={styles.eyebrow}>404 · No signal</p>
        <h1>Page not found.</h1>
        <p>The requested route does not exist.</p>
        <Link to="/">Return home</Link>
      </main>
      <AppFooter />
    </div>
  );
}
