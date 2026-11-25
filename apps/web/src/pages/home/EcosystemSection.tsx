import { ArrowRight, Globe2, Monitor } from 'lucide-react';
import type React from 'react';
import { Link } from 'react-router';
import { BrandMark } from '@components';
import styles from './EcosystemSection.module.scss';

function VsCodeIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg aria-hidden="true" fill="currentColor" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .32 8.688l3.65 3.313-3.65 3.314a1 1 0 0 0 .007 1.427l1.322 1.202a1 1 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zM18 17.5l-6.5-5.5L18 6.5v11z" />
    </svg>
  );
}

type Surface = 'desktop' | 'vscode' | 'web';

type SurfaceBadgeTone = 'calibration' | 'signal';

const surfaceClasses: Record<Surface, string | undefined> = {
  desktop: styles.surfaceDesktop,
  vscode: styles.surfaceVscode,
  web: styles.surfaceWeb,
};

const badgeToneClasses: Record<SurfaceBadgeTone, string | undefined> = {
  calibration: styles.isCalibration,
  signal: styles.isSignal,
};

type WindowLineLength = 'full' | 'short' | 'tiny';

const windowLineClasses: Record<WindowLineLength, string | undefined> = {
  full: styles.windowLine,
  short: `${styles.windowLine} ${styles.short}`,
  tiny: `${styles.windowLine} ${styles.tiny}`,
};

const DOCUMENT_LINES: WindowLineLength[] = ['full', 'short', 'tiny'];

const VSCODE_EDITOR_LINES: WindowLineLength[] = ['full', 'short'];

interface SurfaceCaptionProps {
  lines: [string, string];
}

interface WindowEditorProps {
  lines: WindowLineLength[];
}

interface SurfaceItemProps {
  badge: React.ReactNode;
  badgeTone: SurfaceBadgeTone;
  caption: [string, string];
  children: React.ReactNode;
  surface: Surface;
  title: string;
}

function SurfaceCaption({ lines: [first, second] }: SurfaceCaptionProps): React.JSX.Element {
  return (
    <small>
      {first}
      <br />
      {second}
    </small>
  );
}

function SurfaceItem({
  badge,
  badgeTone,
  caption,
  children,
  surface,
  title,
}: SurfaceItemProps): React.JSX.Element {
  return (
    <article
      className={`${styles.surfaceItem} ${surfaceClasses[surface]}`}
      data-testid="surface-item"
    >
      <strong>{title}</strong>
      <div aria-hidden="true" className={styles.surfaceWindow}>
        <span className={styles.windowDots}>•••</span>
        {children}
        <span className={`${styles.windowBadge} ${badgeToneClasses[badgeTone]}`}>{badge}</span>
      </div>
      <SurfaceCaption lines={caption} />
    </article>
  );
}

function WindowEditor({ lines }: WindowEditorProps): React.JSX.Element {
  return (
    <div className={styles.windowEditor}>
      {lines.map((length) => (
        <span className={windowLineClasses[length]} key={length} />
      ))}
    </div>
  );
}

function CoreHub(): React.JSX.Element {
  return (
    <article className={`${styles.surfaceItem} ${styles.surfaceCore}`} data-testid="surface-item">
      <span aria-hidden="true" className={styles.surfaceCoreSpacer} />
      <div aria-hidden="true" className={styles.sharedCore} data-testid="shared-core">
        <span className={`${styles.coreOrbit} ${styles.outer}`} data-testid="core-orbit" />
        <span className={`${styles.coreOrbit} ${styles.inner}`} />
        <div className={styles.coreCenter}>
          <BrandMark size="md" />
        </div>
      </div>
      <SurfaceCaption lines={['One tool catalog', 'on every surface']} />
    </article>
  );
}

function EcosystemCopy(): React.JSX.Element {
  return (
    <div className={styles.ecosystemCopy}>
      <p className={styles.eyebrow}>One system, every environment</p>
      <h2>
        The same tools.
        <br />
        Wherever you code.
      </h2>
      <p>
        Dev Toolora runs locally with the same tools on the web, on the desktop, and in VS Code.
        Settings and favorites stay on each device.
      </p>
      <Link className={styles.outlineAction} to="/apps">
        Explore all apps
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </div>
  );
}

export function EcosystemSection(): React.JSX.Element {
  return (
    <section className={styles.ecosystemSection} id="apps">
      <div className={`page-frame ${styles.ecosystemLayout}`}>
        <EcosystemCopy />

        <div aria-label="Supported app surfaces" className={styles.surfaceDiagram}>
          <SurfaceItem
            badge={<Globe2 size={16} strokeWidth={1.7} />}
            badgeTone="signal"
            caption={['Instant access', 'in your browser']}
            surface="web"
            title="Web"
          >
            <WindowEditor lines={DOCUMENT_LINES} />
          </SurfaceItem>

          <CoreHub />

          <SurfaceItem
            badge={<Monitor size={16} strokeWidth={1.7} />}
            badgeTone="calibration"
            caption={['Native app', 'for your OS']}
            surface="desktop"
            title="Desktop"
          >
            <WindowEditor lines={DOCUMENT_LINES} />
          </SurfaceItem>

          <SurfaceItem
            badge={<VsCodeIcon size={15} />}
            badgeTone="signal"
            caption={['Extension inside', 'your editor']}
            surface="vscode"
            title="VS Code"
          >
            <div className={styles.windowVscodeLayout}>
              <div className={styles.vscodeActivityBar}>
                <span />
                <span />
                <span />
              </div>
              <WindowEditor lines={VSCODE_EDITOR_LINES} />
            </div>
          </SurfaceItem>
        </div>
      </div>
    </section>
  );
}
