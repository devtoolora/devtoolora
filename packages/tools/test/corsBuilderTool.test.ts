import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { corsBuilderTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (corsBuilderTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('cors builder tool', () => {
  it('declares its fields', () => {
    assert.equal(corsBuilderTool.id, 'cors-builder');
    assert.equal(corsBuilderTool.name, 'CORS Header Builder');
    assert.equal(corsBuilderTool.category, 'Web/API');
    assert.equal(corsBuilderTool.inputKind, 'none');
    assert.equal(corsBuilderTool.outputKind, 'text');

    assert.deepEqual(
      corsBuilderTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['origins', 'Allowed origins', 'https://app.example.com'],
        ['methods', 'Methods', 'GET,POST'],
        ['allowHeaders', 'Allowed request headers', 'Content-Type, Authorization'],
        ['exposeHeaders', 'Exposed response headers', ''],
        ['credentials', 'Allow credentials', 'false'],
        ['maxAge', 'Max age (seconds)', '600'],
        ['privateNetwork', 'Allow private network', 'false'],
      ],
    );

    assert.deepEqual(corsBuilderTool.relatedToolIds, [
      'http-headers-parser',
      'http-request-builder',
      'csp-analyzer',
    ]);

    assert.ok((contentOf(corsBuilderTool).faq?.length ?? 0) >= 4);
    assert.equal(corsBuilderTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of corsBuilderTool.samples ?? []) {
      const output = await result('cors-builder', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], '1 origin · 2 methods · preflight required · no findings');
    assert.match(summaries[1] ?? '', /no preflight for simple requests/);
  });

  it('exports the artifact', async () => {
    const sample = corsBuilderTool.samples?.[0];
    const output = await result('cors-builder', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(output.artifact?.fileName, 'cors-headers.txt');

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('cors-builder', '', { ...fieldDefaults, origins: 'example.com' }),
      /scheme:\/\/host/,
    );
  });
});
