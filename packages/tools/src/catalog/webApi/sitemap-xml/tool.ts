import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const generateOnly = { field: 'mode', is: ['generate'] };
const sampleSitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n  </url>\n  <url>\n    <loc>https://example.com/about</loc>\n    <lastmod>2026-10-01</lastmod>\n  </url>\n</urlset>\n';

export const sitemapXmlTool: ToolDefinition = {
  id: 'sitemap-xml',
  name: 'sitemap.xml Generator & Validator',
  category: 'Web/API',
  description:
    'Generate a sitemap.xml from a list of URLs with lastmod, changefreq and priority, or validate a sitemap or sitemap index against the sitemaps.org rules.',
  samples: [
    {
      fields: { mode: 'generate' },
      label: 'Generate from URLs with metadata',
      text: 'https://example.com/\nhttps://example.com/about 2026-10-01 monthly 0.8',
    },
    {
      fields: { base: 'https://example.com', mode: 'generate' },
      label: 'Generate relative paths with a base',
      text: '/\n/blog?page=2&sort=new\n/contact',
    },
    {
      fields: { mode: 'generate' },
      label: 'Comma-separated columns',
      text: 'https://example.com/,2026-10-01,daily,1.0\nhttps://example.com/docs,2026-09-15T08:00:00Z,weekly,0.5',
    },
    {
      fields: { mode: 'validate' },
      label: 'Validate a correct sitemap',
      text: sampleSitemap,
    },
    {
      fields: { mode: 'validate' },
      label: 'Validate with errors',
      text: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/relative</loc><changefreq>often</changefreq><priority>5</priority></url><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/a</loc></url></urlset>',
    },
    {
      fields: { mode: 'validate' },
      label: 'Validate a sitemap index',
      text: '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/sitemap-posts.xml</loc><lastmod>2026-10-01</lastmod></sitemap><sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap></sitemapindex>',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'generate',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Generate', value: 'generate' },
        { label: 'Validate', value: 'validate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '',
      id: 'base',
      label: 'Base URL',
      type: 'text',
      visibleWhen: generateOnly,
    },
  ],
  keywords: [
    'sitemap',
    'sitemap.xml',
    'sitemap index',
    'sitemaps.org',
    'lastmod',
    'changefreq',
    'priority',
    'seo',
    'crawler',
    'xml',
  ],
  relatedToolIds: ['robots-txt', 'xml-format', 'url-parse'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    if (fields.mode === 'validate') {
      const report = withToolError(() => webFunctions.validateSitemap(text));

      return identityOutput(
        webFunctions.renderSitemapReport(report),
        'sitemap-report.txt',
        `${report.kind} · ${count(report.entries, 'entry', 'entries')} · ${count(report.errors.length, 'error')} · ${count(report.warnings.length, 'warning')}`,
        false,
      );
    }

    const out = withToolError(() => webFunctions.generateSitemap(text, { base: fields.base }));

    return {
      ...identityOutput(
        out.xml,
        'sitemap.xml',
        `sitemap.xml · ${count(out.count, 'URL')} · ${webFunctions.summarizeFindings(out.findings)}`,
        false,
      ),
      language: 'xml',
    };
  },
};

function count(total: number, noun: string, plural = `${noun}s`): string {
  return `${total} ${total === 1 ? noun : plural}`;
}
