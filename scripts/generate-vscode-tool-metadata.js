const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { requireTs } = require('./lib/requireTs.cjs');

const { listBrowserWorkerTools } = requireTs(
  join(__dirname, '..', 'packages', 'browser-catalog', 'src', 'index.ts'),
);

const outputPath = join(
  __dirname,
  '..',
  'apps',
  'vscode',
  'src',
  'extension',
  'toolMetadata.generated.ts',
);
const tools = listBrowserWorkerTools();
const source = `import type { SerializedToolDefinition } from '@devtoolora/core';

export const vscodeToolMetadata: SerializedToolDefinition[] = ${JSON.stringify(tools)};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source);
