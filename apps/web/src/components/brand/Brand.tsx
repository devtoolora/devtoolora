import type React from 'react';
import { Link } from 'react-router';
import styles from './Brand.module.scss';

type BrandMarkSize = 'lg' | 'md' | 'sm';

export interface BrandMarkProps {
  size?: BrandMarkSize;
}

const brandMarkSizeClasses: Record<BrandMarkSize, string | undefined> = {
  lg: styles.sizeLg,
  md: styles.sizeMd,
  sm: styles.sizeSm,
};

export function Brand(): React.JSX.Element {
  return (
    <Link className={styles.brand} to="/">
      <BrandMark />
      <span>
        <strong>Dev Toolora</strong>
        <small>Local dev tools</small>
      </span>
    </Link>
  );
}

export function BrandMark({ size = 'lg' }: BrandMarkProps): React.JSX.Element {
  return (
    <span className={`${styles.brandMark} ${brandMarkSizeClasses[size]}`}>
      <img alt="" className={styles.brandLogoDark} src="/logo.svg" />
      <img alt="" className={styles.brandLogoLight} src="/logo-light.svg" />
    </span>
  );
}
