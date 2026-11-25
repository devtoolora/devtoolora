import type { SerializedToolDefinition } from '@devtoolora/core';
import type { ReactElement } from 'react';
import styles from './RelatedTools.module.scss';

type RelatedToolsProps = {
  tool: SerializedToolDefinition;
  tools: SerializedToolDefinition[];
  onSelectTool(toolId: string): void;
};

export function RelatedTools({
  tool,
  tools,
  onSelectTool,
}: RelatedToolsProps): ReactElement | null {
  const related = (tool.relatedToolIds ?? [])
    .map((toolId) => tools.find((candidate) => candidate.id === toolId))
    .filter((candidate) => candidate !== undefined);

  if (related.length === 0) return null;

  return (
    <section aria-label="Continue with" className={styles.strip}>
      <span className={styles.title}>Continue with</span>
      <div className={styles.grid}>
        {related.map((candidate) => (
          <button
            className={styles.card}
            key={candidate.id}
            type="button"
            onClick={() => onSelectTool(candidate.id)}
          >
            {candidate.name}
          </button>
        ))}
      </div>
    </section>
  );
}
