import { CloudOff, LockKeyhole, Search, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { Input } from '@components';
import styles from './CatalogIntro.module.scss';

export interface CatalogIntroProps {
  query: string;
  toolCount: number;
  onQueryChange(value: string): void;
}

export function CatalogIntro({
  query,
  toolCount,
  onQueryChange,
}: CatalogIntroProps): React.JSX.Element {
  return (
    <section className={styles.intro} data-testid="catalog-intro">
      <p className={styles.eyebrow}>&gt; Tool index</p>
      <h1 className={styles.title}>Every local tool.</h1>
      <p className={styles.lead}>
        Format, convert, inspect, and generate without sending data anywhere.
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

      <div className={styles.searchWrapper}>
        <Input
          aria-label="Search tools"
          placeholder={`Search ${toolCount} tools...`}
          prefix={<Search aria-hidden="true" size={20} />}
          size="lg"
          type="search"
          value={query}
          onChange={onQueryChange}
        />
      </div>
    </section>
  );
}
