import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const toolIds = [
  'json-to-code-types',
  'json-schema-to-typescript',
  'json-schema-to-zod',
  'credit-card-validator',
  'gtin-validator',
  'vat-validator',
  'iso-codes',
  'dotenv-converter',
  'log-timestamp-normalizer',
  'access-log-parser',
  'har-viewer',
  'ansi-stripper',
  'exit-code-reference',
];

describe('type generators, validators and log tools', () => {
  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.equal(tool.samples?.length, 6, id);
      const fieldIds = new Set(tool.fields?.map((field) => field.id));

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
          [],
          `${id}: ${sample.label}`,
        );

        const output = await result(id, sample.text ?? '', {
          ...Object.fromEntries(
            (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
          ),
          ...sample.fields,
        });

        assert.ok(output.text.length > 0, `${id}: ${sample.label}`);
        assert.ok((output.summary ?? '').length > 0, `${id}: ${sample.label}`);
      }
    }
  });

  it('keeps the alias map, flags and the catalog totals', () => {
    const tools = listBrowserWorkerTools();
    const aliases = Object.fromEntries(
      tools.filter((tool) => tool.aliasOf).map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries({
      'ansi-to-html': 'ansi-stripper',
      'dotenv-example': 'dotenv-converter',
      'json-to-csharp': 'json-to-code-types',
      'json-to-go': 'json-to-code-types',
      'json-to-java': 'json-to-code-types',
      'json-to-kotlin': 'json-to-code-types',
      'json-to-python': 'json-to-code-types',
      'json-to-rust': 'json-to-code-types',
      'json-to-swift': 'json-to-code-types',
    }))
      assert.equal(aliases[id], target, id);

    const sensitive = [
      'dotenv-converter',
      'log-timestamp-normalizer',
      'access-log-parser',
      'har-viewer',
      'ansi-stripper',
      'exit-code-reference',
      'credit-card-validator',
    ];

    for (const id of toolIds) {
      const tool = tools.find((entry) => entry.id === id);

      assert.equal(tool?.sensitiveInput === true, sensitive.includes(id), id);
      if (id === 'credit-card-validator') assert.equal(tool?.freshResults, true, id);
    }
  });
});
