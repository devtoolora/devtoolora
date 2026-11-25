import type { SerializedToolDefinition } from '@devtoolora/core';
import { vscodeToolMetadata } from './toolMetadata.generated';

export const tools: SerializedToolDefinition[] = vscodeToolMetadata;

const toolById = new Map(tools.map((tool) => [tool.id, tool]));

export function getTool(id: string): SerializedToolDefinition {
  const tool = toolById.get(id);

  if (!tool) {
    throw new Error(`Unknown tool: ${id}`);
  }

  return tool;
}
