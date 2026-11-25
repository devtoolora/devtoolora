import type { SerializedToolDefinition } from '@devtoolora/core';
import { detectContext } from '@devtoolora/core/context';

export type ContextToolPickerEntry =
  | { description: string; kind: 'tool'; suggested: boolean; tool: SerializedToolDefinition }
  | { kind: 'separator'; label: string };

export function buildContextToolPickerEntries(
  selection: string,
  candidates: readonly SerializedToolDefinition[],
): ContextToolPickerEntry[] {
  const detectedContext = detectContext(selection);
  const candidatesById = new Map(candidates.map((tool) => [tool.id, tool]));
  const suggestedTools = (detectedContext?.toolIds ?? [])
    .map((toolId) => candidatesById.get(toolId))
    .filter((tool): tool is SerializedToolDefinition => Boolean(tool));
  const suggestedToolIds = new Set(suggestedTools.map((tool) => tool.id));
  const entries: ContextToolPickerEntry[] = [];

  if (detectedContext && suggestedTools.length > 0) {
    entries.push({ kind: 'separator', label: `Suggested for ${detectedContext.label}` });

    entries.push(
      ...suggestedTools.map((tool) => ({
        kind: 'tool' as const,
        tool,
        suggested: true,
        description: `Suggested for ${detectedContext.label}`,
      })),
    );
  }

  const remainingTools = candidates.filter(
    (tool) => !tool.aliasOf && !suggestedToolIds.has(tool.id),
  );

  if (remainingTools.length > 0) {
    entries.push({ kind: 'separator', label: 'All compatible tools' });

    entries.push(
      ...remainingTools.map((tool) => ({
        kind: 'tool' as const,
        tool,
        suggested: false,
        description: tool.category,
      })),
    );
  }

  return entries;
}
