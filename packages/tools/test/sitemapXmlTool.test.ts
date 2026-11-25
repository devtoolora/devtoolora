import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sitemapXmlTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (sitemapXmlTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('sitemap.xml tool', () => {
  it('declares its fields', () => {
    assert.equal(sitemapXmlTool.id, 'sitemap-xml');
    assert.equal(sitemapXmlTool.name, 'sitemap.xml Generator & Validator');
    assert.equal(sitemapXmlTool.category, 'Web/API');
    assert.equal(sitemapXmlTool.inputKind, 'text');
    assert.equal(sitemapXmlTool.outputKind, 'text');

    assert.deepEqual(
      sitemapXmlTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['mode', 'Mode', 'generate'],
        ['base', 'Base URL', ''],
      ],
    );

    assert.deepEqual(sitemapXmlTool.relatedToolIds, ['robots-txt', 'xml-format', 'url-parse']);
    assert.ok((contentOf(sitemapXmlTool).faq?.length ?? 0) >= 4);
    assert.equal(sitemapXmlTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of sitemapXmlTool.samples ?? []) {
      const output = await result('sitemap-xml', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], 'sitemap.xml · 2 URLs · no findings');
    assert.equal(summaries[3], 'urlset · 2 entries · 0 errors · 0 warnings');
  });

  it('exports the artifact', async () => {
    const sample = sitemapXmlTool.samples?.[0];
    const output = await result('sitemap-xml', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );

    assert.equal(output.artifact?.fileName, 'sitemap.xml');
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('sitemap-xml', '/relative', { ...fieldDefaults, mode: 'generate' }),
      /Base URL/,
    );
  });
});
