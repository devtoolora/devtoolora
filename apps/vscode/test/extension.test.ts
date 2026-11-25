import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tools } from '../src/extension/toolRegistry';
import { filterTools } from '../src/webview/client/utils/filterTools';
import { normalizeToolDrafts } from '../src/webview/client/utils/state';
import { buildContextToolPickerEntries } from '../src/extension/contextToolPicker';
import { detectContext, type SerializedToolDefinition, type ToolCategory } from '@devtoolora/core';

describe('tool search and saved drafts', () => {
  function finderTool(overrides: Partial<SerializedToolDefinition>): SerializedToolDefinition {
    return {
      id: 'demo-tool',
      name: 'Demo Tool',
      category: 'Text',
      description: 'Demo tool.',
      inputKind: 'none',
      outputKind: 'text',
      supportsSelection: false,
      ...overrides,
    };
  }

  it('ranks search by exact name, name prefix, keyword or category, description, then stable order', () => {
    const finderTools = [
      finderTool({
        id: 'description',
        name: 'Delta',
        category: 'Text',
        description: 'Works with needle content.',
      }),
      finderTool({
        id: 'keyword',
        name: 'Archive',
        category: 'Text',
        description: 'Unrelated.',
        keywords: ['needle-helper'],
      }),
      finderTool({
        id: 'prefix',
        name: 'Needle Builder',
        category: 'Text',
        description: 'Unrelated.',
      }),
      finderTool({ id: 'exact', name: 'Needle', category: 'Text', description: 'Unrelated.' }),
      finderTool({
        id: 'category',
        name: 'Utility',
        category: 'Needle Tools' as ToolCategory,
        description: 'Unrelated.',
      }),
      finderTool({ id: 'miss', name: 'Other', category: 'Text', description: 'Unrelated.' }),
    ];

    assert.deepEqual(
      filterTools(finderTools, 'needle').map((tool) => tool.id),
      ['exact', 'prefix', 'keyword', 'category', 'description'],
    );

    assert.deepEqual(
      filterTools(finderTools, '').map((tool) => tool.id),
      finderTools.map((tool) => tool.id),
    );
  });

  it('keeps only valid, non-file values when restoring persisted drafts', () => {
    const draftTools = [
      finderTool({
        id: 'image-tool',
        fields: [
          { id: 'title', label: 'Title', type: 'text' },
          { id: 'image', label: 'Image', type: 'file' },
        ],
      }),
    ];

    assert.deepEqual(
      normalizeToolDrafts(draftTools, {
        'image-tool': {
          input: 'keep this',
          fields: {
            title: 'Draft title',
            image: 'data:image/png;base64,large',
            imageName: 'image.png',
            stale: 'discard me',
          },
        },
        missing: { input: 'discard', fields: {} },
      }),
      { 'image-tool': { input: 'keep this', fields: { title: 'Draft title' } } },
    );
  });
});

describe('smart context actions', () => {
  it('detects only high-confidence formats with stable suggested tool ordering', () => {
    const cases = [
      ['curl https://api.example.com/users', 'curl', ['curl-to-fetch']],
      [
        'GET /users HTTP/1.1\nHost: api.example.com\nAccept: application/json\n',
        'http',
        ['raw-http-request-inspector', 'http-headers-parser'],
      ],
      ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature', 'jwt', ['jwt-parse']],
      ['{"name":"Ada"}', 'json', ['json-format', 'json-tree', 'json-to-typescript']],
      ['<note><title>Hello</title></note>', 'xml', ['xml-format', 'xml-to-json']],
      ['name,age\nAda,36', 'csv', ['csv-profiler', 'csv-to-json']],
      ['https://example.com/docs?q=tools', 'url', ['url-parse', 'query-string-parser']],
      ['tab=tools&sort=recent', 'query', ['query-string-parser']],
      ['name: Dev Toolora\nversion: 1', 'yaml', ['yaml-to-json']],
      [
        '{"level":"info"}\n{"level":"error"}',
        'jsonl',
        ['json-lines-inspector', 'log-filter', 'raw-log-redactor'],
      ],
      ['TypeError: bad\n    at parse (/app/a.ts:1:2)', 'stackTrace', ['stack-trace-cleaner']],
    ] as const;

    for (const [input, kind, toolIds] of cases) {
      const detected = detectContext(input);

      assert.equal(detected?.kind, kind);
      assert.deepEqual(detected?.toolIds, toolIds);
    }
  });

  it('rejects malformed or ambiguous inputs and keeps deterministic precedence', () => {
    assert.equal(detectContext('curl'), undefined);
    assert.equal(detectContext('GET / HTTP/1.1\nHost example.com'), undefined);
    assert.equal(detectContext('{"name":'), undefined);
    assert.equal(detectContext('name,age\n"Ada,36'), undefined);
    assert.equal(detectContext('<note>'), undefined);
    assert.equal(detectContext('just ordinary text'), undefined);

    assert.equal(
      detectContext('curl https://api.example.com HTTP/1.1\nHost: api.example.com\n')?.kind,
      'curl',
    );
  });

  it('places suggested tools before the compatible fallback without duplicates', () => {
    const entries = buildContextToolPickerEntries(
      '{"name":"Ada"}',
      tools.filter((tool) => tool.supportsSelection),
    );

    assert.deepEqual(
      entries
        .slice(0, 4)
        .map((entry) => (entry.kind === 'separator' ? entry.label : entry.tool.id)),
      ['Suggested for JSON', 'json-format', 'json-tree', 'json-to-typescript'],
    );

    const allToolsSeparator = entries.findIndex(
      (entry) => entry.kind === 'separator' && entry.label === 'All compatible tools',
    );

    assert.ok(allToolsSeparator > 3);

    assert.equal(
      entries
        .slice(allToolsSeparator + 1)
        .some((entry) => entry.kind === 'tool' && entry.tool.id === 'json-format'),
      false,
    );
  });

  it('keeps the full compatible fallback when the selection has no recognized format', () => {
    const entries = buildContextToolPickerEntries(
      'ordinary prose',
      tools.filter((tool) => tool.supportsSelection),
    );

    assert.equal(entries[0]?.kind, 'separator');
    assert.equal(entries[0]?.kind === 'separator' ? entries[0].label : '', 'All compatible tools');

    assert.equal(
      entries.some((entry) => entry.kind === 'tool' && entry.suggested),
      false,
    );
  });
});

describe('extension manifest', () => {
  it('does not repeat the category in command titles', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'apps/vscode/package.json'), 'utf8'),
    ) as { contributes: { commands: Array<{ category: string; title: string }> } };

    for (const command of manifest.contributes.commands)
      assert.ok(!command.title.startsWith(command.category), command.title);
  });
});
