import { CloudOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { AppFooter, AppHeader } from '@components';
import { HeroFlowField, HeroTriangle, TechnicalOverlay } from '@/features/hero';
import { CommandSearch } from '@/features/search';
import { CategoryDirectory } from './CategoryDirectory';
import { EcosystemSection } from './EcosystemSection';
import type { HomeDirectory } from './homeDirectory';
import styles from './Homepage.module.scss';
import { PrivacyStrip } from './PrivacyStrip';

export interface HomepageProps {
  directory: HomeDirectory;
  isLightTheme: boolean;
  onToggleTheme(): void;
}

function HeroCopy(): React.JSX.Element {
  return (
    <div className={styles.heroCopy} data-testid="hero-copy">
      <h1 id="hero-title">
        Every tool.
        <br />
        Right where
        <br />
        you work.
      </h1>
      <p className={styles.heroDescription}>
        Format, convert, inspect, generate, and debug without sending your data anywhere.
      </p>
      <div aria-label="Privacy and availability" className={styles.trustLine}>
        <span>
          <LockKeyhole size={14} />
          Runs locally
        </span>
        <span>
          <CloudOff size={15} />
          Works offline
        </span>
        <span>
          <ShieldCheck size={15} />
          No uploads
        </span>
      </div>
    </div>
  );
}

export function Homepage({
  directory,
  isLightTheme,
  onToggleTheme,
}: HomepageProps): React.JSX.Element {
  return (
    <>
      <AppHeader isLightTheme={isLightTheme} onToggleTheme={onToggleTheme} />

      <main data-tool-count={directory.toolCount}>
        <section aria-labelledby="hero-title" className={styles.hero} data-testid="hero">
          <HeroFlowField isLightTheme={isLightTheme} />
          <HeroTriangle />
          <TechnicalOverlay />

          <div className={`${styles.heroContent} page-frame`}>
            <HeroCopy />

            <div className={styles.heroSearch} data-testid="hero-search">
              <CommandSearch
                defaultResults={directory.defaultResults}
                toolCount={directory.toolCount}
              />
            </div>
          </div>

          <div aria-hidden="true" className={styles.axisAnnotation}>
            <span className={styles.axisY}>y</span>
            <span className={styles.axisX}>x</span>
          </div>
          <span aria-hidden="true" className={`${styles.fieldEquation} ${styles.fieldEquationTop}`}>
            curl (x, y, z) →
          </span>
        </section>

        <CategoryDirectory directory={directory} />
        <EcosystemSection />
        <PrivacyStrip />
      </main>

      <AppFooter variant="home" />
    </>
  );
}
