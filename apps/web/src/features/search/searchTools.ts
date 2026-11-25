import type { WebToolMetadata } from '@/toolMetadata';

const defaultToolIds = ['json-format', 'jwt-parse', 'base64-encode', 'regex-test', 'uuid'];

export function searchTools(tools: WebToolMetadata[], query: string, limit = 5): WebToolMetadata[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return defaultToolIds
      .map((id) => tools.find((tool) => tool.id === id))
      .filter((tool): tool is WebToolMetadata => Boolean(tool))
      .slice(0, limit);
  }

  return tools
    .map((tool, index) => ({
      index,
      score: scoreQuery(tool, normalizedQuery),
      tool,
    }))
    .filter((result) => result.score < Number.POSITIVE_INFINITY)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((result) => result.tool);
}

function scoreQuery(tool: WebToolMetadata, query: string): number {
  const score = scoreTool(tool, query);
  const words = query.split(/\s+/);

  if (score < Number.POSITIVE_INFINITY || words.length === 1) return score;

  return Math.max(...words.map((word) => scoreTool(tool, word)));
}

function scoreTool(tool: WebToolMetadata, query: string): number {
  const name = normalize(tool.name);
  const id = normalize(tool.id);
  const category = normalize(tool.category);
  const keywords = tool.keywords.map(normalize);

  if (name === query || id === query) return 0;
  if (name.startsWith(query) || id.startsWith(query)) return 1;

  if (
    name.includes(query) ||
    id.includes(query) ||
    category.includes(query) ||
    keywords.some((keyword) => keyword.includes(query))
  ) {
    return 2;
  }

  if (normalize(tool.description).includes(query)) return 3;

  return Number.POSITIVE_INFINITY;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
