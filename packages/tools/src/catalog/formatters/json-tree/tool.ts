import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { processJsonDocument } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

export const jsonTreeTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Explore JSON in an expandable, searchable tree with exact scalar tokens, types and JSON Pointer paths.',
  id: 'json-tree',
  inputKind: 'text',
  keywords: ['json viewer', 'tree', 'explorer', 'json pointer', 'nested', 'search'],
  name: 'JSON Tree',
  outputKind: 'text',
  relatedToolIds: ['json-format', 'json-query', 'json-diff', 'json-schema-validator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() => {
      const document = processJsonDocument(text, { collectTree: true, mode: 'minify' });
      let characters = 0;
      const lines = document.nodes.map((node) => {
        const content =
          node.type === 'object' || node.type === 'array'
            ? `${node.type}[${node.childCount}]`
            : `${node.type}: ${node.token}`;
        const line = `${'  '.repeat(node.depth)}${node.label} (${JSON.stringify(node.pointer)}): ${content}`;

        characters += line.length + 1;
        if (characters > 8_000_000)
          throw new ToolError('JSON Tree text export is limited to 8,000,000 characters.');

        return line;
      });
      const outline = lines.join('\n');

      return {
        artifact: {
          base64: encodeBase64Text(outline),
          fileName: 'json-tree.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        jsonTree: { nodes: document.nodes },
        language: 'plaintext',
        summary: `${document.nodes.length} values · ${document.report.maxDepth} container levels · ${document.report.duplicateKeys} duplicate keys · ${document.report.numbersOutsideSafeRange} numeric-range warnings.`,
        text: outline,
      };
    }),
  samples: [
    {
      label: 'Nested user and roles',
      text: '{"user":{"name":"Ada","roles":["admin","dev"],"active":true},"settings":{"theme":"dark"}}',
    },
    {
      label: 'Paths with special keys',
      text: '{"a/b~c":{"":9007199254740993},"a.b":[{"name":"Příliš žluťoučký 🐎"}]}',
    },
    {
      label: 'Null and empty values',
      text: '{"nothing":null,"emptyString":"","emptyArray":[],"emptyObject":{},"number":1.00,"numericString":"1.00"}',
    },
    { label: 'Duplicate roles', text: '{"role":"user","\\u0072ole":"admin"}' },
    {
      label: 'Unsafe HTML stays text',
      text: '{"message":"<img src=x onerror=alert(1)>","escaped":"Line one\\nLine two","huge":1e400}',
    },
    {
      label: 'Root array of records',
      text: '[{"id":1,"name":"Ada","tags":["admin","dev"]},{"id":2,"name":"Grace","tags":[]},{"id":3,"name":"Linus","tags":null}]',
    },
  ],
  supportsSelection: true,
};
