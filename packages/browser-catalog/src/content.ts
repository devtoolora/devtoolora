import type { ToolContent } from '@devtoolora/core';
import { toolContentLoaders } from '@devtoolora/tools/catalog/content.generated';

/** Loads the texts of one tool; `toolId` is the canonical id (aliases share their tool's texts). */
export async function loadToolContent(toolId: string): Promise<ToolContent | undefined> {
  const loader = Object.hasOwn(toolContentLoaders, toolId) ? toolContentLoaders[toolId] : undefined;

  return loader && (await loader()).content;
}
