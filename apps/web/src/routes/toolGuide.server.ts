import type { SerializedToolDefinition, ToolContent } from '@devtoolora/core';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { loadToolContent } from '@devtoolora/browser-catalog/content';

export type ToolGuide = ToolContent & { definition: SerializedToolDefinition };

let tools: SerializedToolDefinition[] | undefined;

export async function toolGuide(id: string): Promise<ToolGuide | null> {
  tools ??= listBrowserWorkerTools();
  const tool = tools.find((candidate) => candidate.id === id);

  if (!tool) return null;

  const content = await loadToolContent(tool.aliasOf ?? tool.id);

  // Loader data must be plain JSON: undefined fields are dropped.
  return JSON.parse(JSON.stringify({ ...content, definition: tool })) as ToolGuide;
}
