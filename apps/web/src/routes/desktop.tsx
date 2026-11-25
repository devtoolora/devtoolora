import type { MetaFunction } from 'react-router';
import { DesktopApp } from '@/features/desktop';
import { useIsHydrated } from '@/lib/useIsHydrated';

export const meta: MetaFunction = () => [
  { title: 'Dev Toolora Desktop' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export default function DesktopRoute() {
  // The desktop reads stored settings, the system theme and `?tool=` on its first render, so the
  // prerendered shell stays empty until hydration instead of guessing them.
  return useIsHydrated() ? <DesktopApp /> : <main aria-busy="true" />;
}
