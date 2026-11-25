import { ArrowRight, CloudOff, ExternalLink } from 'lucide-react';
import type React from 'react';
import { Link } from 'react-router';
import { Breadcrumbs } from '../breadcrumbs';
import { Badge } from '../ui';
import {
  aboutSurfaces,
  type PublicPageCommand,
  publicPageContent,
  type PublicPageFeature,
  type PublicPageKind,
  type PublicPageScreenshot,
} from './publicPageContent';
import styles from './PublicPage.module.scss';

export type { PublicPageKind } from './publicPageContent';

export interface PublicPageProps {
  kind: PublicPageKind;
}

const breadcrumbLabels: Record<PublicPageKind, string> = {
  about: 'About',
  apps: 'Apps',
  extension: 'Extension',
};

function FeatureTitle({ href, title, to }: PublicPageFeature): React.JSX.Element {
  if (to) return <Link to={to}>{title}</Link>;

  if (href) {
    return (
      <a href={href} rel="noreferrer" target="_blank">
        {title}
        <ExternalLink aria-hidden="true" size={13} />
      </a>
    );
  }

  return <>{title}</>;
}

function FeatureSection({
  features,
  title,
}: {
  features: PublicPageFeature[];
  title: string;
}): React.JSX.Element {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <ul className={`${styles.features} ${features.length === 3 ? styles.featuresThree : ''}`}>
        {features.map((feature) => (
          <li key={feature.title}>
            <feature.icon aria-hidden="true" size={20} />
            <h3>
              <FeatureTitle {...feature} />
            </h3>
            <p>{feature.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PageScreenshot({ alt, name }: PublicPageScreenshot): React.JSX.Element {
  return (
    <figure className={styles.screenshot}>
      <img
        alt={alt}
        className={styles.screenshotDark}
        height={800}
        loading="lazy"
        src={`/screens/${name}-dark.webp`}
        width={1280}
      />
      <img
        alt={alt}
        className={styles.screenshotLight}
        height={800}
        loading="lazy"
        src={`/screens/${name}-light.webp`}
        width={1280}
      />
    </figure>
  );
}

function CommandSection({ commands }: { commands: PublicPageCommand[] }): React.JSX.Element {
  return (
    <section className={styles.section}>
      <h2>Commands</h2>
      <p className={styles.sectionLead}>Open the Command Palette and type “Dev Toolora”.</p>
      <dl className={styles.commands}>
        {commands.map(({ name, text }) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PublicPage({ kind }: PublicPageProps): React.JSX.Element {
  const page = publicPageContent[kind];

  return (
    <main className={`${styles.publicPage} page-frame`}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: breadcrumbLabels[kind] }]} />

      <header className={styles.header}>
        <p className={styles.eyebrow}>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.lead}</p>
        {page.status && (
          <div className={styles.status}>
            <Badge size="sm" variant="calibration">
              {page.status}
            </Badge>
            <span>{page.statusNote}</span>
          </div>
        )}
      </header>

      {page.screenshot && <PageScreenshot {...page.screenshot} />}

      <FeatureSection features={page.features} title={page.featuresTitle} />

      {page.commands && <CommandSection commands={page.commands} />}

      {kind === 'about' && <FeatureSection features={aboutSurfaces} title="Where you can use it" />}

      <section className={styles.action}>
        <CloudOff aria-hidden="true" />

        <div>
          <h2>Use every tool now on the web.</h2>
          <p>The browser version runs locally and works offline after installation.</p>
        </div>

        <Link to="/tools">
          Open tools
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </section>
    </main>
  );
}
