import type { SerializedToolDefinition } from '@devtoolora/core';
import { Star } from 'lucide-react';
import type { ReactElement } from 'react';
import { ToolIcon } from '../tool-icon';
import styles from './ToolHeader.module.scss';

type ToolHeaderProps = {
  isFavorite: boolean;
  tool: SerializedToolDefinition;
  onToggleFavorite(): void;
};

export function ToolHeader({ isFavorite, tool, onToggleFavorite }: ToolHeaderProps): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <div className={styles.titleLine}>
          <ToolIcon badge={tool.badge} category={tool.category} />
          <span className={styles.category}>{tool.category}</span>
          <h1 className={styles.title}>{tool.name}</h1>
        </div>
        <p className={styles.description}>{tool.description}</p>
      </div>
      <button
        aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
        aria-pressed={isFavorite}
        className={styles.favorite}
        type="button"
        onClick={onToggleFavorite}
      >
        <Star aria-hidden="true" fill={isFavorite ? 'currentColor' : 'none'} size={16} />
      </button>
    </header>
  );
}
