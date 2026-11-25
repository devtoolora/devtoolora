import { searchTools } from '@/features/search/searchTools';
import type { WebToolMetadata } from '@/toolMetadata';

const featuredToolsPerCategory = 4;

type HomeFeaturedTool = Pick<WebToolMetadata, 'name' | 'slug'>;

export interface HomeCategorySummary {
  featuredTools: HomeFeaturedTool[];
  toolCount: number;
}

export interface HomeDirectory {
  categories: Partial<Record<string, HomeCategorySummary>>;
  defaultResults: WebToolMetadata[];
  toolCount: number;
}

export function buildHomeDirectory(tools: WebToolMetadata[]): HomeDirectory {
  const categories: Partial<Record<string, HomeCategorySummary>> = {};

  for (const tool of tools) {
    const summary = (categories[tool.category] ??= { featuredTools: [], toolCount: 0 });

    summary.toolCount += 1;

    if (summary.featuredTools.length < featuredToolsPerCategory) {
      summary.featuredTools.push({ name: tool.name, slug: tool.slug || tool.id });
    }
  }

  return { categories, defaultResults: searchTools(tools, ''), toolCount: tools.length };
}

export async function loadHomeDirectory(): Promise<HomeDirectory> {
  const { webToolMetadata } = await import('@/toolMetadata.generated');

  return buildHomeDirectory(webToolMetadata);
}
