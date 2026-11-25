import { useEffect, useMemo } from 'react';
import { useLocation, type MetaFunction } from 'react-router';
import { Breadcrumbs } from '@components';
import {
  CATEGORY_ICON_MAP,
  CatalogFilters,
  CatalogIntro,
  ToolCard,
  restoreCatalogScroll,
  useFavorites,
  useToolCatalog,
} from '@/features/tools';
import { routeMeta } from '../lib/seo';
import { webToolMetadata } from '../toolMetadata.generated';
import styles from './tools.module.scss';

export const meta: MetaFunction = () =>
  routeMeta(
    'Local Developer Tools — Dev Toolora',
    'Browse private, offline-ready formatters, encoders, generators, inspectors, and developer utilities.',
    '/tools',
  );

export default function ToolsRoute() {
  const location = useLocation();
  const favorites = useFavorites();
  const catalog = useToolCatalog(webToolMetadata, favorites.favoriteIds);
  const categories = useMemo(
    () =>
      Object.keys(CATEGORY_ICON_MAP)
        .map((name) => ({
          count: webToolMetadata.filter((tool) => tool.category === name).length,
          name,
        }))
        .filter((category) => category.count > 0),
    [],
  );
  const catalogHref = `${location.pathname}${location.search}`;

  useEffect(() => restoreCatalogScroll(catalogHref), [catalogHref]);

  return (
    <main className={`${styles.toolsPage} page-frame`}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Tools' }]} />
      <CatalogIntro
        query={catalog.query}
        toolCount={webToolMetadata.length}
        onQueryChange={catalog.onQueryChange}
      />
      <div className={styles.catalogLayout}>
        <CatalogFilters
          activeCategory={catalog.category}
          categories={categories}
          favoriteCount={favorites.favoriteIds.size}
          favoritesOnly={catalog.favoritesOnly}
          totalCount={webToolMetadata.length}
          onCategoryChange={catalog.onCategoryChange}
          onFavoritesOnlyChange={catalog.onFavoritesOnlyChange}
        />
        <p className="sr-only" role="status">
          {catalog.filteredTools.length} {catalog.filteredTools.length === 1 ? 'tool' : 'tools'}
        </p>
        <section aria-label="Tools" className={styles.toolGrid} data-testid="tool-grid">
          {catalog.filteredTools.map((tool) => (
            <ToolCard
              catalogHref={catalogHref}
              isFavorite={favorites.favoriteIds.has(tool.id)}
              key={tool.id}
              tool={tool}
              onFavoriteToggle={() => favorites.onFavoriteToggle(tool.id)}
            />
          ))}
          {!catalog.filteredTools.length && (
            <p className={styles.catalogEmpty}>No tools match these filters.</p>
          )}
        </section>
      </div>
    </main>
  );
}
