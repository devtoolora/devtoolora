import type { MetaFunction } from 'react-router';
import { PublicPage } from '../components/public-page';
import { routeMeta } from '../lib/seo';

export const meta: MetaFunction = () =>
  routeMeta(
    'About — Dev Toolora',
    'Dev Toolora is a set of more than 250 developer tools that run on your device, with no accounts and no uploads.',
    '/about',
  );

export default function AboutRoute() {
  return <PublicPage kind="about" />;
}
