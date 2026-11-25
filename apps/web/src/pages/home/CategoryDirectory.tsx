import { ArrowRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@components';
// Not the barrel: Rolldown would pull its favorites hook, and with it all tool metadata, into home.
import {
  CATEGORY_ICON_MAP,
  FEATURED_HOMEPAGE_CATEGORIES,
} from '@/features/tools/utils/categoryIcons';
import type { HomeCategorySummary, HomeDirectory } from './homeDirectory';
import styles from './CategoryDirectory.module.scss';

export interface CategoryDirectoryProps {
  directory: HomeDirectory;
}

const allCategories = Object.values(CATEGORY_ICON_MAP);
const featuredCategories = FEATURED_HOMEPAGE_CATEGORIES.map((cat) => CATEGORY_ICON_MAP[cat]).filter(
  Boolean,
);

const shortCategoryNames: Record<string, string> = {
  'Images & Codes': 'Images',
  'Web/API': 'Web & API',
};

const iconAccentClasses: Record<(typeof allCategories)[number]['accent'], string | undefined> = {
  calibration: styles.isCalibration,
  signal: styles.isSignal,
};

interface CategoryRowProps {
  categoryEntry: (typeof allCategories)[number];
  summary?: HomeCategorySummary;
}

function CategoryRow({
  categoryEntry: { category, description, icon: Icon, glyph, accent },
  summary = { featuredTools: [], toolCount: 0 },
}: CategoryRowProps): React.JSX.Element {
  const { featuredTools, toolCount } = summary;
  const displayName = shortCategoryNames[category] ?? category;
  const categoryHref = `/tools?category=${encodeURIComponent(category)}`;

  let iconContent: ReactNode;

  if (glyph) {
    iconContent = <span className={styles.categoryGlyph}>{glyph}</span>;
  } else {
    iconContent = <Icon aria-hidden="true" size={20} strokeWidth={1.6} />;
  }

  return (
    <div className={styles.categoryRow} data-testid="category-row">
      <Link className={styles.categoryMainLink} data-testid="category-main-link" to={categoryHref}>
        <span
          aria-hidden="true"
          className={`${styles.categoryIcon} ${iconAccentClasses[accent]}`}
          data-testid="category-icon"
        >
          {iconContent}
        </span>

        <span className={styles.categoryCopy}>
          <strong>{displayName}</strong>
          <small>{description}</small>
        </span>
      </Link>

      <Link aria-hidden="true" className={styles.categoryCount} tabIndex={-1} to={categoryHref}>
        {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
      </Link>

      <div className={styles.categoryFeatured} data-testid="category-featured">
        {featuredTools.map((tool, idx) => (
          <span className={styles.featuredToolItem} key={tool.slug}>
            <Link
              className={styles.featuredToolLink}
              data-testid="featured-tool-link"
              to={`/tools/${tool.slug}`}
            >
              {tool.name}
            </Link>

            {idx < featuredTools.length - 1 && <span className={styles.featuredSeparator}>, </span>}
          </span>
        ))}

        <Link
          aria-hidden="true"
          className={styles.categoryArrowLink}
          data-testid="category-arrow-link"
          tabIndex={-1}
          to={categoryHref}
        >
          <ArrowRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </div>
  );
}

export function CategoryDirectory({ directory }: CategoryDirectoryProps): React.JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const displayedCategories = showAll ? allCategories : featuredCategories;

  const handleToggleShowAll = (): void => {
    setShowAll((prev) => !prev);
  };

  return (
    <section className={styles.categorySection} id="tools">
      <div className="page-frame">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Browse by category</p>
            <h2>Find the right tool instantly.</h2>
          </div>

          <p>
            Organized by how you think about your work. Built for speed, privacy, and precision.
          </p>
        </div>

        <div className={styles.categoryList}>
          {displayedCategories.map((categoryEntry) => (
            <CategoryRow
              categoryEntry={categoryEntry}
              key={categoryEntry.category}
              summary={directory.categories[categoryEntry.category]}
            />
          ))}
        </div>

        <div className={styles.categorySectionFooter}>
          <Link className={styles.sectionLink} to="/tools">
            View all {directory.toolCount} tools
            <ArrowRight aria-hidden="true" size={17} />
          </Link>

          <Button size="md" type="button" variant="outline" onClick={handleToggleShowAll}>
            {showAll ? 'Show top 8 categories' : `Show all ${allCategories.length} categories`}
          </Button>
        </div>
      </div>
    </section>
  );
}
