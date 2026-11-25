import { type ClientLoaderFunctionArgs, type MetaFunction, useLoaderData } from 'react-router';
import { useTheme } from '@/features/theme';
import { Homepage } from '@/pages/home';
import { loadHomeDirectory, type HomeDirectory } from '@/pages/home/homeDirectory';
import { routeMeta } from '../lib/seo';

export function loader(): Promise<HomeDirectory> {
  return loadHomeDirectory();
}

// Offline, a client navigation has no prerendered data file.
export async function clientLoader({
  serverLoader,
}: ClientLoaderFunctionArgs): Promise<HomeDirectory> {
  try {
    return await serverLoader<typeof loader>();
  } catch {
    return loadHomeDirectory();
  }
}

export const meta: MetaFunction = () =>
  routeMeta(
    'Dev Toolora — Local Developer Tools',
    'Format, convert, inspect, generate, and debug locally. No uploads required.',
    '/',
  );

export default function HomeRoute() {
  const theme = useTheme();
  const directory = useLoaderData<typeof loader>();

  return <Homepage directory={directory} {...theme} />;
}
