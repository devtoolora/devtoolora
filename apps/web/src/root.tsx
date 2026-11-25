import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLocation,
} from 'react-router';
import { useEffect } from 'react';
import { adoptInlinedStylesheets, dropOrphanedInlineStyles } from './lib/adoptInlinedStylesheets';
import './styles/base.css';
import styles from './root.module.scss';
import { whenIdleAfterLoad } from './lib/whenIdleAfterLoad';

// connect-src keeps every request on this origin, except the anonymous, cookieless page-view
// beacon of Cloudflare Web Analytics, which Cloudflare injects on the hosted site. Tool input never
// leaves the page. Inline scripts come from the prerendered router data and the theme script. The
// desktop page ships Tauri's own CSP, which allows IPC and has no analytics.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' data: blob: https://cloudflareinsights.com",
  "font-src 'self' data:",
  "form-action 'none'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => dropOrphanedInlineStyles(), [pathname]);

  useEffect(() => {
    // The load event fires before React Router hydrates; browser tests wait for this marker.
    document.documentElement.dataset.hydrated = '';
    adoptInlinedStylesheets();

    const isDesktop = window.location.pathname.startsWith('/desktop') || 'isTauri' in window;

    if (import.meta.env.PROD && !isDesktop && 'serviceWorker' in navigator) {
      return whenIdleAfterLoad(() => void navigator.serviceWorker.register('/sw.js'));
    } else if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    }

    return undefined;
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {!pathname.startsWith('/desktop') && (
          <meta content={CONTENT_SECURITY_POLICY} httpEquiv="Content-Security-Policy" />
        )}
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="#0b172d" name="theme-color" />
        <link href="/favicon.ico" rel="icon" sizes="48x48" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <link href="/manifest.webmanifest" rel="manifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{if(location.pathname.endsWith('/desktop/index.html')){history.replaceState(null,'','/desktop'+location.search+location.hash);}var t=localStorage.getItem('dev-tools-theme');var d=location.pathname.startsWith('/desktop');if(t==='light'||(d&&t!=='dark'&&matchMedia('(prefers-color-scheme: light)').matches)){document.documentElement.dataset.theme='light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#f2f6f8');}else{document.documentElement.dataset.theme='dark';}}catch(e){}})();`,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const message = isRouteErrorResponse(error) ? error.statusText : 'Unexpected application error.';

  return (
    <main className={`page-frame ${styles.errorPage}`}>
      <p className={styles.eyebrow}>Signal interrupted</p>
      <h1>Something went wrong.</h1>
      <p>{message}</p>
      <Link to="/">Return home</Link>
    </main>
  );
}
