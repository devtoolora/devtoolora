import type { ToolBadge, ToolCategory } from '@devtoolora/core';
import type React from 'react';
import { BADGE_ICONS, getCategoryMeta } from '../../utils/categoryIcons';
import styles from './CategoryIcon.module.scss';

type CategoryIconVariant = 'compact' | 'default';

export interface CategoryIconProps {
  badge?: ToolBadge;
  category: ToolCategory | string;
  showBadge?: boolean;
  size?: number;
  /** Sizes the plain icon only; the badge always uses its own box. */
  variant?: CategoryIconVariant;
}

const wrapperVariantClasses: Record<CategoryIconVariant, string | undefined> = {
  compact: styles.wrapperCompact,
  default: undefined,
};

export function CategoryIcon({
  badge,
  category,
  showBadge = false,
  size = 18,
  variant = 'default',
}: CategoryIconProps): React.JSX.Element {
  const meta = getCategoryMeta(category);
  const accent = badge?.accent ?? meta.accent;
  const accentClass = accent === 'calibration' ? styles.isCalibration : styles.isSignal;

  let content: React.ReactNode;

  if (badge && 'glyph' in badge) {
    const glyphStyle: React.CSSProperties = {
      whiteSpace: 'nowrap',
      ...(showBadge
        ? {}
        : { fontSize: `${Math.max(9, Math.round(size * 0.72))}px`, lineHeight: 1 }),
    };

    content = (
      <span aria-hidden="true" className={styles.glyph} style={glyphStyle}>
        {badge.glyph}
      </span>
    );
  } else if (badge) {
    const CustomIcon = BADGE_ICONS[badge.icon];

    content = <CustomIcon aria-hidden="true" size={size} strokeWidth={1.5} />;
  } else {
    const Icon = meta.icon;

    content = <Icon aria-hidden="true" size={size} strokeWidth={1.5} />;
  }

  if (showBadge) {
    return (
      <span aria-hidden="true" className={`${styles.badge} ${accentClass}`}>
        {content}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={[styles.wrapper, wrapperVariantClasses[variant], accentClass]
        .filter(Boolean)
        .join(' ')}
    >
      {content}
    </span>
  );
}
