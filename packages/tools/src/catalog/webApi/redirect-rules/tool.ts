import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const targetLabels: Record<webFunctions.RedirectTarget, { file: string; label: string }> = {
  apache: { file: '.htaccess', label: 'Apache .htaccess' },
  netlify: { file: '_redirects', label: 'Netlify / Cloudflare Pages' },
  nginx: { file: 'nginx-redirects.conf', label: 'nginx' },
  vercel: { file: 'vercel.json', label: 'Vercel' },
};
const plainRules = '/old /new\n/blog/* /articles/:splat\n/gone https://other.example/x';
const sampleRules = '/old /new\n/blog/* /articles/:splat 302\n/gone -> https://other.example/x 308';

export const redirectRulesTool: ToolDefinition = {
  id: 'redirect-rules',
  name: 'Redirect Rule Generator',
  category: 'Web/API',
  description:
    'Turn a list of redirects into nginx, Apache .htaccess, Netlify / Cloudflare Pages _redirects or Vercel vercel.json rules, and flag loops, duplicates and redirect chains.',
  samples: [
    {
      fields: { status: '301', target: 'netlify' },
      label: 'Netlify with a wildcard',
      text: plainRules,
    },
    {
      fields: { status: '301', target: 'nginx' },
      label: 'nginx location blocks',
      text: sampleRules,
    },
    {
      fields: { status: '301', target: 'apache' },
      label: 'Apache .htaccess',
      text: sampleRules,
    },
    {
      fields: { status: '301', target: 'vercel' },
      label: 'Vercel vercel.json',
      text: sampleRules,
    },
    {
      fields: { status: '301', target: 'netlify' },
      label: 'Chain and duplicate findings',
      text: '/a /b\n/b /c\n/a /d\n/loop /loop 302',
    },
    {
      fields: { status: '302', target: 'netlify' },
      label: 'Arrow and comma separators',
      text: '/a -> /b\n/c,/d\n/e → /f 301',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'netlify',
      id: 'target',
      label: 'Target',
      options: Object.entries(targetLabels).map(([value, { label }]) => ({ label, value })),
      type: 'select',
    },
    {
      defaultValue: '301',
      id: 'status',
      label: 'Default status',
      options: ['301', '302', '307', '308'].map((value) => ({ label: value, value })),
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: [
    'redirect',
    '301',
    '302',
    'nginx',
    'htaccess',
    'apache',
    'netlify',
    '_redirects',
    'cloudflare pages',
    'vercel',
    'rewrite',
  ],
  relatedToolIds: ['url-parse', 'http-status', 'robots-txt'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const target = fields.target ?? 'netlify';
    const out = withToolError(() =>
      webFunctions.generateRedirects(text, { status: fields.status ?? '301', target }),
    );
    const meta = targetLabels[target as webFunctions.RedirectTarget];

    return {
      ...identityOutput(
        out.text,
        meta.file,
        `${out.count} ${out.count === 1 ? 'rule' : 'rules'} · ${meta.label} · ${webFunctions.summarizeFindings(out.findings)}`,
        false,
      ),
      language: target === 'vercel' ? 'json' : 'plaintext',
    };
  },
};
