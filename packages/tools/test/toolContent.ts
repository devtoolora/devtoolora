import type { ToolContent } from '@devtoolora/core';
import { toolContentLoaders } from '../src/catalog/content.generated';

const contents = new Map(
  await Promise.all(
    Object.entries(toolContentLoaders).map(
      async ([id, load]) => [id, (await load()).content] as const,
    ),
  ),
);

export function contentOf(tool: { aliasOf?: string; id: string }): ToolContent {
  return contents.get(tool.aliasOf ?? tool.id) ?? {};
}
