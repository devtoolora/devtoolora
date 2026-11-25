import { ChevronRight } from 'lucide-react';
import { CategoryIcon } from '@/features/tools';
import type { WebToolMetadata } from '@/toolMetadata';
import styles from './DesktopToolLink.module.scss';

type DesktopToolLinkVariant = 'chip' | 'row';

export interface DesktopToolLinkProps {
  active: boolean;
  tool: WebToolMetadata;
  variant?: DesktopToolLinkVariant;
  onOpen(tool: WebToolMetadata): void;
}

const variantClasses: Record<DesktopToolLinkVariant, string | undefined> = {
  chip: `${styles.toolLink} ${styles.chip}`,
  row: styles.toolLink,
};

export function DesktopToolLink({ active, tool, variant = 'row', onOpen }: DesktopToolLinkProps) {
  return (
    <button
      aria-current={active || undefined}
      className={variantClasses[variant]}
      data-active={active}
      type="button"
      onClick={() => onOpen(tool)}
    >
      <CategoryIcon badge={tool.badge} category={tool.category} size={14} variant="compact" />
      <span>{tool.name}</span>
      <ChevronRight aria-hidden="true" size={13} />
    </button>
  );
}
