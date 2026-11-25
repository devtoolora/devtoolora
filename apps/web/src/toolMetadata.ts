import type { ToolBadge, ToolCategory, ToolRuntimeCapability } from '@devtoolora/core';

export type WebToolMetadata = {
  aliasOf?: string;
  badge?: ToolBadge;
  capabilities: ToolRuntimeCapability[];
  category: ToolCategory;
  description: string;
  id: string;
  keywords: string[];
  name: string;
  slug: string;
};
