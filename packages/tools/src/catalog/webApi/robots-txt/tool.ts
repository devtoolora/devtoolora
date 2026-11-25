import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const testOnly = { field: 'mode', is: ['test'] };
const generateOnly = { field: 'mode', is: ['generate'] };
const sampleFile = [
  'User-agent: *',
  'Disallow: /admin/',
  '',
  'User-agent: Googlebot',
  'Disallow: /private/',
  'Allow: /private/public/',
  'Sitemap: https://example.com/sitemap.xml',
].join('\n');

export const robotsTxtTool: ToolDefinition = {
  id: 'robots-txt',
  name: 'robots.txt Generator & Tester',
  category: 'Web/API',
  description:
    'Test which paths a robots.txt allows for a crawler using RFC 9309 group and longest-match rules, or generate a robots.txt file.',
  samples: [
    {
      fields: {
        agent: 'Googlebot',
        mode: 'test',
        paths: '/private/x\n/private/public/y\n/index.html',
      },
      label: 'Test Googlebot rules',
      text: sampleFile,
    },
    {
      fields: { agent: 'Bingbot', mode: 'test', paths: '/admin/x\n/private/x' },
      label: 'Test the default group',
      text: sampleFile,
    },
    {
      fields: {
        agent: 'Googlebot',
        mode: 'test',
        paths: '/docs/a.pdf\n/docs/b.pdfx\n/files/c.pdf\n/search?session=1',
      },
      label: 'Wildcards and end anchors',
      text: 'User-agent: *\nDisallow: /*.pdf$\nDisallow: /*?session=\nAllow: /docs/*.pdf$',
    },
    {
      fields: {
        agent: 'Googlebot',
        mode: 'test',
        paths: 'https://example.com/admin/page?x=1\nhttps://example.com/',
      },
      label: 'Full URLs as paths',
      text: 'User-agent: *\nDisallow: /admin/',
    },
    {
      fields: { disallow: '/admin/\n/tmp/', genAgent: '*', mode: 'generate' },
      label: 'Generate a standard file',
      text: '',
    },
    {
      fields: {
        allow: '/admin/public/',
        crawlDelay: '10',
        disallow: '/admin/',
        genAgent: 'Bingbot',
        mode: 'generate',
        sitemaps: 'https://example.com/sitemap.xml',
      },
      label: 'Generate with sitemap and crawl delay',
      text: '',
    },
  ],
  inputKind: 'text',
  inputVisibleWhen: testOnly,
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'test',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Test', value: 'test' },
        { label: 'Generate', value: 'generate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'Googlebot',
      id: 'agent',
      label: 'User agent to test',
      type: 'text',
      visibleWhen: testOnly,
    },
    {
      defaultValue: '/',
      id: 'paths',
      label: 'Paths to test',
      type: 'textarea',
      visibleWhen: testOnly,
    },
    {
      defaultValue: '*',
      id: 'genAgent',
      label: 'User agent',
      type: 'text',
      visibleWhen: generateOnly,
    },
    {
      defaultValue: '',
      id: 'disallow',
      label: 'Disallow paths',
      type: 'textarea',
      visibleWhen: generateOnly,
    },
    {
      defaultValue: '',
      id: 'allow',
      label: 'Allow paths',
      type: 'textarea',
      visibleWhen: generateOnly,
    },
    {
      defaultValue: '',
      id: 'sitemaps',
      label: 'Sitemap URLs',
      type: 'textarea',
      visibleWhen: generateOnly,
    },
    {
      defaultValue: '',
      id: 'crawlDelay',
      label: 'Crawl delay (seconds)',
      type: 'text',
      visibleWhen: generateOnly,
    },
  ],
  keywords: [
    'robots.txt',
    'robots',
    'crawler',
    'user-agent',
    'disallow',
    'allow',
    'sitemap',
    'crawl delay',
    'googlebot',
    'rfc 9309',
  ],
  relatedToolIds: ['url-parse', 'meta-tag-generator', 'http-status'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => (fields.mode === 'generate' ? generate(fields) : test(text, fields)),
};

function count(total: number, noun: string): string {
  return `${total} ${noun}${total === 1 ? '' : 's'}`;
}

function test(text: string, fields: Record<string, string>): ToolResult {
  const agent = fields.agent ?? '';
  const report = withToolError(() =>
    webFunctions.testRobots(text, { agent, paths: fields.paths ?? '' }),
  );
  const allowed = report.results.filter((result) => result.allowed).length;
  const token = agent.trim().toLowerCase();
  const group = report.group
    ? ` · group "${report.group.agents[0] ?? token}"`
    : ' · no matching group';

  return identityOutput(
    webFunctions.renderRobotsTestReport(report, agent),
    'robots-test.txt',
    `${count(report.results.length, 'path')} · ${allowed} allowed · ${report.results.length - allowed} blocked${group}`,
    false,
  );
}

function generate(fields: Record<string, string>): ToolResult {
  const output = withToolError(() =>
    webFunctions.generateRobots({
      agent: fields.genAgent,
      allow: fields.allow,
      crawlDelay: fields.crawlDelay,
      disallow: fields.disallow,
      sitemaps: fields.sitemaps,
    }),
  );
  const file = webFunctions.parseRobots(output);
  const rules = file.groups.reduce((total, group) => total + group.rules.length, 0);

  return identityOutput(
    output,
    'robots.txt',
    `robots.txt · ${count(rules, 'rule')} · ${count(file.sitemaps.length, 'sitemap')}`,
    false,
  );
}
