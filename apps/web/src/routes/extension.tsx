import type { MetaFunction } from 'react-router';
import { PublicPage } from '../components/public-page';
import { routeMeta } from '../lib/seo';

export const meta: MetaFunction = () =>
  routeMeta(
    'VS Code Extension — Dev Toolora',
    'Run local developer tools on your selection and put the result back in your file. Dev Toolora for VS Code, coming soon.',
    '/extension',
  );

export default function ExtensionRoute() {
  return <PublicPage kind="extension" />;
}
