import { loadToolContent } from '@devtoolora/browser-catalog/content';
import type { SerializedToolDefinition, ToolContent } from '@devtoolora/core';
import { useEffect, useState } from 'react';

export function useToolContent(
  tool?: Pick<SerializedToolDefinition, 'aliasOf' | 'id'>,
): ToolContent | undefined {
  const contentId = tool && (tool.aliasOf ?? tool.id);
  const [loaded, setLoaded] = useState<{ content?: ToolContent; id: string }>();

  useEffect(() => {
    if (!contentId) return undefined;

    let isCurrent = true;

    loadToolContent(contentId).then(
      (content) => isCurrent && setLoaded({ content, id: contentId }),
      () => undefined,
    );

    return () => {
      isCurrent = false;
    };
  }, [contentId]);

  return loaded && loaded.id === contentId ? loaded.content : undefined;
}
