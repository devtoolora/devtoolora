import { ArrowRight, Laptop, Wifi } from 'lucide-react';
import type React from 'react';
import { Link } from 'react-router';
import type { WebToolMetadata } from '@/toolMetadata';
import { rememberCatalogScroll } from '../../utils/catalogNavigation';
import { CategoryIcon } from '../category-icon';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { FavoriteButton } from '../favorite-button';
import styles from './ToolCard.module.scss';

export interface ToolCardProps {
  catalogHref: string;
  isFavorite: boolean;
  tool: WebToolMetadata;
  onFavoriteToggle(): void;
}

export function ToolCard({
  catalogHref,
  isFavorite,
  tool,
  onFavoriteToggle,
}: ToolCardProps): React.JSX.Element {
  const meta = getCategoryMeta(tool.category);
  const isCalibration = meta.accent === 'calibration';

  const handleCardClick = (): void => {
    rememberCatalogScroll(catalogHref);
  };

  const articleClassName = ['tool-card', styles.toolCard, isCalibration && styles.hasCalibration]
    .filter(Boolean)
    .join(' ');

  const categoryClassName = [styles.category, isCalibration && styles.isCalibration]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={articleClassName}>
      <Link
        className={styles.link}
        state={{ catalogHref }}
        to={`/tools/${tool.slug}`}
        onClick={handleCardClick}
      >
        <CategoryIcon badge={tool.badge} category={tool.category} showBadge size={22} />

        <div className={styles.content}>
          <small className={categoryClassName}>{tool.category}</small>
          <strong className={styles.title}>{tool.name}</strong>
          <p className={styles.desc}>{tool.description}</p>
        </div>

        <span className={styles.trust}>
          <Laptop size={15} />
          Runs locally
          <b>·</b>
          <Wifi size={15} />
          Works offline
        </span>

        <ArrowRight aria-hidden="true" className={styles.arrow} size={20} />
      </Link>

      <div className={styles.favoriteSlot}>
        <FavoriteButton isFavorite={isFavorite} toolName={tool.name} onToggle={onFavoriteToggle} />
      </div>
    </article>
  );
}
