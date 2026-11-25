import type { MetaFunction } from 'react-router';
import { PublicPage } from '../components/public-page';
import { routeMeta } from '../lib/seo';

export const meta: MetaFunction = () =>
  routeMeta(
    'Desktop App — Dev Toolora',
    'Dev Toolora for macOS, Windows and Linux: the same local developer tools in their own window, coming soon.',
    '/apps',
  );

export default function AppsRoute() {
  return <PublicPage kind="apps" />;
}
