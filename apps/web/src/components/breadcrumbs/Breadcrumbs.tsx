import type React from 'react';
import { Link } from 'react-router';
import styles from './Breadcrumbs.module.scss';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps): React.JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      {items.map((item, index) => (
        <span className={styles.item} key={`${item.label}-${index}`}>
          {index > 0 && <span aria-hidden="true">/</span>}

          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <strong aria-current="page">{item.label}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}
