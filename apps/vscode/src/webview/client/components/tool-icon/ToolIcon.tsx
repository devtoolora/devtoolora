import type { ToolBadge } from '@devtoolora/core';
import type { ReactElement } from 'react';
import {
  type AccentVariant,
  FALLBACK_SVG_META,
  CATEGORY_SVG_MAP,
  BADGE_SVGS,
} from '../../utils/categoryIconsSvg';
import styles from './ToolIcon.module.scss';

type ToolIconProps = {
  badge?: ToolBadge;
  category: string;
  size?: number;
};

const accentClasses: Record<AccentVariant, string | undefined> = {
  calibration: styles.calibration,
  signal: styles.signal,
};

export function ToolIcon({ badge, category, size = 13 }: ToolIconProps): ReactElement {
  const meta = CATEGORY_SVG_MAP[category] ?? FALLBACK_SVG_META;
  const accent = badge?.accent ?? meta.accent;

  return (
    <span aria-hidden="true" className={`${styles.icon} ${accentClasses[accent]}`}>
      {badge && 'glyph' in badge ? (
        <span className={styles.glyph}>{badge.glyph}</span>
      ) : (
        <svg
          dangerouslySetInnerHTML={{
            __html: badge && 'icon' in badge ? BADGE_SVGS[badge.icon] : meta.svgPaths,
          }}
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          viewBox="0 0 24 24"
          width={size}
        />
      )}
    </span>
  );
}
