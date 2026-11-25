import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { utmBuilderTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (utmBuilderTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('utm builder tool', () => {
  it('declares its fields', () => {
    assert.equal(utmBuilderTool.id, 'utm-builder');
    assert.equal(utmBuilderTool.name, 'UTM Link Builder');
    assert.equal(utmBuilderTool.category, 'Web/API');
    assert.equal(utmBuilderTool.inputKind, 'none');
    assert.equal(utmBuilderTool.outputKind, 'text');

    assert.deepEqual(
      utmBuilderTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['url', 'Destination URL', 'https://example.com/'],
        ['source', 'Source (utm_source)', ''],
        ['medium', 'Medium (utm_medium)', ''],
        ['campaign', 'Campaign (utm_campaign)', ''],
        ['term', 'Term (utm_term)', ''],
        ['content', 'Content (utm_content)', ''],
        ['id', 'Campaign ID (utm_id)', ''],
        ['lowercase', 'Lowercase values', 'true'],
      ],
    );

    assert.deepEqual(
      utmBuilderTool.fields?.filter(({ required }) => required).map(({ id }) => id),
      ['url', 'source'],
    );

    assert.deepEqual(utmBuilderTool.relatedToolIds, [
      'url-parse',
      'query-string-parser',
      'url-encode',
    ]);

    assert.ok((contentOf(utmBuilderTool).faq?.length ?? 0) >= 4);
    assert.equal(utmBuilderTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of utmBuilderTool.samples ?? []) {
      const output = await result('utm-builder', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], '3 parameters · 1 info');
  });

  it('exports the artifact', async () => {
    const sample = utmBuilderTool.samples?.[0];
    const output = await result('utm-builder', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(output.artifact?.fileName, 'utm-link.txt');

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('utm-builder', '', { ...fieldDefaults, source: 'x', url: 'example.com' }),
      /absolute http/,
    );
  });
});
