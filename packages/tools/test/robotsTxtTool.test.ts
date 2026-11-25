import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { robotsTxtTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (robotsTxtTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('robots.txt tool', () => {
  it('declares its fields', () => {
    assert.equal(robotsTxtTool.id, 'robots-txt');
    assert.equal(robotsTxtTool.name, 'robots.txt Generator & Tester');
    assert.equal(robotsTxtTool.category, 'Web/API');
    assert.equal(robotsTxtTool.inputKind, 'text');
    assert.equal(robotsTxtTool.outputKind, 'text');

    assert.deepEqual(
      robotsTxtTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['mode', 'Mode', 'test'],
        ['agent', 'User agent to test', 'Googlebot'],
        ['paths', 'Paths to test', '/'],
        ['genAgent', 'User agent', '*'],
        ['disallow', 'Disallow paths', ''],
        ['allow', 'Allow paths', ''],
        ['sitemaps', 'Sitemap URLs', ''],
        ['crawlDelay', 'Crawl delay (seconds)', ''],
      ],
    );

    assert.deepEqual(robotsTxtTool.relatedToolIds, [
      'url-parse',
      'meta-tag-generator',
      'http-status',
    ]);

    assert.ok((contentOf(robotsTxtTool).faq?.length ?? 0) >= 4);
    assert.equal(robotsTxtTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of robotsTxtTool.samples ?? []) {
      const output = await result('robots-txt', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], '3 paths · 2 allowed · 1 blocked · group "googlebot"');
    assert.equal(summaries[4], 'robots.txt · 2 rules · 0 sitemaps');
    assert.equal(summaries[5], 'robots.txt · 2 rules · 1 sitemap');
  });

  it('exports the artifact', async () => {
    const sample = robotsTxtTool.samples?.[0];
    const output = await result('robots-txt', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('robots-txt', 'x'.repeat(500_001), { ...fieldDefaults, mode: 'test' }),
      /exceeds 500,000 characters/,
    );
  });
});
