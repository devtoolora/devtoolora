import { detectContext, type SerializedToolDefinition } from '@devtoolora/core';
import { Button } from '@devtoolora/tool-ui';
import type { ReactElement } from 'react';
import styles from './ContextTools.module.scss';

type ContextToolsProps = {
  activeToolId?: string;
  intro?: string;
  label: string;
  text: string;
  tools: SerializedToolDefinition[];
  onSelectTool(toolId: string, text: string): void;
};

export function ContextTools({
  activeToolId,
  intro = '',
  label,
  text,
  tools,
  onSelectTool,
}: ContextToolsProps): ReactElement | null {
  const detected = text.trim() ? detectContext(text) : undefined;
  const suggested = (detected?.toolIds ?? [])
    .filter((toolId) => toolId !== activeToolId)
    .map((toolId) => tools.find((tool) => tool.id === toolId))
    .filter((tool) => tool !== undefined);

  if (!detected || suggested.length === 0) return null;

  return (
    <section aria-label={label} className={styles.section}>
      <p className={styles.label}>
        {intro}Detected {detected.label}.
      </p>
      <div className={styles.actions}>
        {suggested.map((tool) => (
          <Button
            key={tool.id}
            size="sm"
            variant="secondary"
            onClick={() => onSelectTool(tool.id, text)}
          >
            {tool.name}
          </Button>
        ))}
      </div>
    </section>
  );
}
