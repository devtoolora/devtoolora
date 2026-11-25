import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonLdGeneratorTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (jsonLdGeneratorTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('json-ld generator tool', () => {
  it('declares its fields', () => {
    assert.equal(jsonLdGeneratorTool.id, 'json-ld-generator');
    assert.equal(jsonLdGeneratorTool.name, 'JSON-LD Structured Data Generator');
    assert.equal(jsonLdGeneratorTool.category, 'Web/API');
    assert.equal(jsonLdGeneratorTool.inputKind, 'text');
    assert.equal(jsonLdGeneratorTool.outputKind, 'text');

    assert.deepEqual(
      jsonLdGeneratorTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['type', 'Type', 'Article'],
        ['format', 'Output', 'script'],
        ['headline', 'Headline', ''],
        ['description', 'Description', ''],
        ['images', 'Images (one per line)', ''],
        ['author', 'Author', ''],
        ['publisherName', 'Publisher name', ''],
        ['publisherLogo', 'Publisher logo URL', ''],
        ['datePublished', 'Date published', ''],
        ['dateModified', 'Date modified', ''],
        ['url', 'URL', ''],
        ['name', 'Name', ''],
        ['sku', 'SKU', ''],
        ['brand', 'Brand', ''],
        ['price', 'Price', ''],
        ['currency', 'Currency', ''],
        ['availability', 'Availability', ''],
        ['ratingValue', 'Rating value', ''],
        ['reviewCount', 'Review count', ''],
        ['logo', 'Logo URL', ''],
        ['sameAs', 'Profiles (sameAs, one per line)', ''],
        ['telephone', 'Telephone', ''],
        ['email', 'Email', ''],
      ],
    );

    assert.deepEqual(
      jsonLdGeneratorTool.fields?.filter(({ required }) => required).map(({ id }) => id),
      ['headline', 'name'],
    );

    assert.deepEqual(jsonLdGeneratorTool.relatedToolIds, [
      'meta-tag-generator',
      'json-format',
      'html-format',
    ]);

    assert.ok((contentOf(jsonLdGeneratorTool).faq?.length ?? 0) >= 4);
    assert.equal(jsonLdGeneratorTool.samples?.length, 6);

    for (const sample of jsonLdGeneratorTool.samples ?? []) {
      assert.ok(sample.fields?.type);
      assert.ok(sample.fields?.format);
    }
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of jsonLdGeneratorTool.samples ?? []) {
      const output = await result('json-ld-generator', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], 'Article · 5 properties · no findings');
  });

  it('exports the artifact', async () => {
    const sample = jsonLdGeneratorTool.samples?.[0];
    const output = await result('json-ld-generator', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(output.language, 'html');
    assert.equal(output.artifact?.fileName, 'structured-data.html');

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('json-ld-generator', '', {
        ...fieldDefaults,
        headline: 'x',
        type: 'Article',
        url: 'example.com',
      }),
      /absolute http/,
    );
  });
});
