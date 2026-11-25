import { Grid2X2, Star } from 'lucide-react';
import type React from 'react';
import { CategoryIcon } from '../category-icon';
import styles from './CatalogFilters.module.scss';

interface CategoryCount {
  count: number;
  name: string;
}

export interface CatalogFiltersProps {
  activeCategory: string;
  categories: CategoryCount[];
  favoriteCount: number;
  favoritesOnly: boolean;
  totalCount: number;
  onCategoryChange(value: string): void;
  onFavoritesOnlyChange(value: boolean): void;
}

export function CatalogFilters({
  activeCategory,
  categories,
  favoriteCount,
  favoritesOnly,
  totalCount,
  onCategoryChange,
  onFavoritesOnlyChange,
}: CatalogFiltersProps): React.JSX.Element {
  const isAllToolsActive = !activeCategory && !favoritesOnly;

  const handleAllToolsClick = (): void => {
    onCategoryChange('');
  };

  const handleFavoritesClick = (): void => {
    onFavoritesOnlyChange(!favoritesOnly);
  };

  return (
    <aside aria-label="Tool categories" className={styles.filters}>
      <button
        aria-pressed={isAllToolsActive}
        className={`${styles.button} ${isAllToolsActive ? `is-active ${styles.isActive}` : ''}`.trim()}
        type="button"
        onClick={handleAllToolsClick}
      >
        <Grid2X2 size={18} />
        <span>All tools</span>
        <small className={styles.count}>{totalCount}</small>
      </button>

      <button
        aria-pressed={favoritesOnly}
        className={`${styles.button} ${favoritesOnly ? `is-active ${styles.isActive}` : ''}`.trim()}
        type="button"
        onClick={handleFavoritesClick}
      >
        <Star size={18} />
        <span>Favorites</span>
        <small className={styles.count}>{favoriteCount}</small>
      </button>

      {categories.map((category) => {
        const isCategoryActive = !favoritesOnly && activeCategory === category.name;

        return (
          <button
            aria-pressed={isCategoryActive}
            className={`${styles.button} ${isCategoryActive ? `is-active ${styles.isActive}` : ''}`.trim()}
            key={category.name}
            type="button"
            onClick={() => onCategoryChange(category.name)}
          >
            <CategoryIcon category={category.name} size={16} />
            <span>{category.name}</span>
            <small className={styles.count}>{category.count}</small>
          </button>
        );
      })}
    </aside>
  );
}
