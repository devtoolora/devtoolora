const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { requireTs } = require('./lib/requireTs.cjs');

const { listBrowserWorkerTools } = requireTs(
  join(__dirname, '..', 'packages', 'browser-catalog', 'src', 'index.ts'),
);

const outputPath = join(__dirname, '..', 'apps', 'web', 'src', 'toolMetadata.generated.ts');
const tools = listBrowserWorkerTools().map((tool) => ({
  id: tool.id,
  slug: tool.id,
  name: tool.name,
  category: tool.category,
  description: tool.description,
  keywords: tool.keywords ?? [],
  capabilities: tool.capabilities ?? [],
  ...(tool.aliasOf ? { aliasOf: tool.aliasOf } : {}),
  ...(tool.badge ? { badge: tool.badge } : {}),
}));
const source = `import type { WebToolMetadata } from './toolMetadata';

export const webToolMetadata: WebToolMetadata[] = ${JSON.stringify(
  tools.filter((tool) => !tool.aliasOf),
  null,
  2,
)};

export const webToolAliases: WebToolMetadata[] = ${JSON.stringify(
  tools.filter((tool) => tool.aliasOf),
  null,
  2,
)};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source);
