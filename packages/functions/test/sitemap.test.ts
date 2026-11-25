import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { generateSitemap, renderSitemapReport, validateSitemap } from '@devtoolora/functions/web';

const generated =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n  </url>\n  <url>\n    <loc>https://example.com/about</loc>\n    <lastmod>2026-10-01</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>\n';

describe('sitemap', () => {
  it('generates a sitemap', () => {
    const out = generateSitemap(
      'https://example.com/\nhttps://example.com/about 2026-10-01 monthly 0.8',
    );

    assert.equal(out.xml, generated);
    assert.equal(out.count, 2);

    assert.match(
      generateSitemap('/a\n/b?x=1&y=2', { base: 'https://example.com' }).xml,
      /<loc>https:\/\/example.com\/b\?x=1&amp;y=2<\/loc>/,
    );

    assert.equal(generateSitemap('https://example.com/\nhttps://example.com/').count, 1);

    assert.equal(
      generateSitemap('https://example.com/\nhttps://example.com/').findings[0]?.level,
      'info',
    );

    assert.equal(
      generateSitemap('https://example.com/a,2026-10-01T10:00:00+02:00,daily,1.0').count,
      1,
    );

    assert.throws(() => generateSitemap('/a'), /Line 1: "\/a" is relative; set the Base URL\./);

    assert.throws(
      () => generateSitemap('https://example.com/ yesterday'),
      /Line 1: lastmod "yesterday" is not a W3C datetime\./,
    );

    assert.throws(
      () => generateSitemap('https://example.com/ 2026-10-01 sometimes'),
      /Line 1: changefreq "sometimes" must be one of always, hourly, daily, weekly, monthly, yearly, never\./,
    );

    assert.throws(
      () => generateSitemap('https://example.com/ 2026-10-01 daily 2'),
      /Line 1: priority "2" must be between 0.0 and 1.0\./,
    );

    assert.throws(() => generateSitemap(''), /Sitemap input is required\./);

    assert.throws(
      () =>
        generateSitemap(
          Array.from({ length: 50_001 }, (_, i) => `https://example.com/${i}`).join('\n'),
        ),
      /Sitemap input exceeds 50,000 URLs\./,
    );

    assert.equal(
      generateSitemap(
        Array.from({ length: 50_000 }, (_, i) => `https://example.com/${i}`).join('\n'),
      ).count,
      50_000,
    );
  });

  it('validates a sitemap', () => {
    const now = new Date('2026-10-26T00:00:00Z');
    const ok = validateSitemap(generated, { now });

    assert.deepEqual(ok, {
      entries: 2,
      errors: [],
      hosts: ['example.com'],
      kind: 'urlset',
      warnings: [],
    });

    const bad = validateSitemap(
      '<urlset><url><loc>/relative</loc><lastmod>soon</lastmod><changefreq>often</changefreq><priority>5</priority><foo/></url><url><loc>https://example.com/a?x=1&amp;y=2</loc><lastmod>2030-01-01</lastmod></url><url><loc>https://example.com/a?x=1&amp;y=2</loc></url><url><loc>https://other.example/</loc></url></urlset>',
      { now },
    );

    assert.deepEqual(bad.errors, [
      'Entry 1: loc "/relative" is not an absolute http(s) URL.',
      'Entry 1: lastmod "soon" is not a W3C datetime.',
      'Entry 1: changefreq "often" must be one of always, hourly, daily, weekly, monthly, yearly, never.',
      'Entry 1: priority "5" must be between 0.0 and 1.0.',
    ]);

    assert.deepEqual(bad.warnings, [
      'The root element has no sitemaps.org namespace.',
      'Entry 1: unknown element "foo".',
      'Entry 2: lastmod is in the future.',
      'Entry 3: duplicate loc "https://example.com/a?x=1&y=2".',
      'Entry 4: host "other.example" differs from "example.com".',
    ]);

    assert.equal(
      validateSitemap(
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>',
      ).kind,
      'sitemapindex',
    );

    assert.throws(
      () => validateSitemap('<html/>'),
      /Root element must be urlset or sitemapindex\./,
    );

    assert.throws(() => validateSitemap('not xml'), /Invalid XML/);

    const many = (count: number): string =>
      `<urlset>${Array.from({ length: count }, (_, n) => `<url><loc>https://example.com/${n}</loc></url>`).join('')}</urlset>`;

    assert.equal(validateSitemap(many(50_000)).entries, 50_000);
    assert.throws(() => validateSitemap(many(50_001)), /Sitemap exceeds 50,000 entries\./);

    assert.equal(
      validateSitemap(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>https://example.com/</loc><xhtml:link rel="alternate"/></url></urlset>',
      ).warnings.length,
      0,
    );

    assert.equal(
      validateSitemap(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc><priority>.5</priority><lastmod>2026-02-30</lastmod></url></urlset>',
      ).errors.join(),
      'Entry 1: lastmod "2026-02-30" is not a W3C datetime.',
    );

    assert.throws(
      () => generateSitemap('ftp://x.example/a'),
      /Line 1: "ftp:\/\/x.example\/a" is not an http\(s\) URL\./,
    );

    assert.throws(
      () => generateSitemap('/a', { base: 'ftp://x.example' }),
      /Line 1: "\/a" is not an http\(s\) URL\./,
    );
  });

  it('renders a report', () => {
    const report = validateSitemap('<urlset><url><loc>/x</loc></url></urlset>');
    const text = renderSitemapReport(report);

    assert.match(text, /^Kind: urlset\nEntries: 1\nHosts: none/);
    assert.match(text, /# Errors\n- Entry 1: loc "\/x"/);
    assert.match(text, /# Warnings\n- The root element/);
  });

  it('reads children that share the root namespace prefix', () => {
    const report = validateSitemap(
      '<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"><sm:url><sm:loc>https://example.com/</sm:loc></sm:url></sm:urlset>',
    );

    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
  });

  it('limits generate input and loc length', () => {
    assert.throws(
      () => generateSitemap('a'.repeat(5_000_001)),
      /Sitemap input exceeds 5,000,000 characters\./,
    );

    assert.throws(
      () => generateSitemap(`https://example.com/${'a'.repeat(2_048)}`),
      /Line 1: loc exceeds 2,048 characters\./,
    );
  });
});
