export type CatalogTool = {
  aliasOf?: string;
  category: string;
  description: string;
  id: string;
  keywords?: string[];
  name: string;
};

export function filterTools<T extends CatalogTool>(tools: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  const canonicalTools = tools.filter((tool) => !tool.aliasOf);

  if (!normalized) return canonicalTools;

  return canonicalTools
    .map((tool, index) => ({ index, rank: rankToolMatch(tool, normalized), tool }))
    .filter((match): match is { index: number; rank: number; tool: T } => match.rank !== undefined)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((match) => match.tool);
}

function rankToolMatch(tool: CatalogTool, query: string): number | undefined {
  const name = tool.name.toLowerCase();
  const category = tool.category.toLowerCase();
  const description = tool.description.toLowerCase();
  const keywords = (tool.keywords ?? []).map((keyword) => keyword.toLowerCase());

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (
    name.includes(query) ||
    category.includes(query) ||
    keywords.some((keyword) => keyword.includes(query))
  )
    return 2;
  if (description.includes(query)) return 3;

  return undefined;
}

export function groupToolsByCategory<T extends CatalogTool>(tools: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const tool of tools) {
    if (tool.aliasOf) continue;

    const categoryTools = grouped.get(tool.category) ?? [];

    categoryTools.push(tool);
    grouped.set(tool.category, categoryTools);
  }

  return grouped;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays}d ago`;
}
