import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const strict =
  "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

export const cspAnalyzerTool: ToolDefinition = {
  id: 'csp-analyzer',
  name: 'CSP Builder & Analyzer',
  category: 'Web/API',
  description:
    'Normalize a Content-Security-Policy from a header, meta tag or one directive per line and check it for unsafe sources and missing directives.',
  samples: [
    { fields: { format: 'report' }, label: 'Strict nonce-based policy', text: strict },
    {
      fields: { format: 'report' },
      label: 'Legacy unsafe-inline policy',
      text: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    },
    {
      fields: { format: 'report' },
      label: 'Header line copied from DevTools',
      text: "Content-Security-Policy: default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'",
    },
    {
      fields: { format: 'report' },
      label: 'One directive per line (builder)',
      text: "default-src 'self'\nscript-src 'self' https://cdn.example.com\nobject-src 'none'\nbase-uri 'none'",
    },
    {
      fields: { format: 'header' },
      label: 'Report-only header',
      text: "Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-reports",
    },
    { fields: { format: 'meta' }, label: 'Meta tag', text: strict },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'report',
      id: 'format',
      label: 'Output',
      options: [
        { label: 'Report', value: 'report' },
        { label: 'Header', value: 'header' },
        { label: 'Meta tag', value: 'meta' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: [
    'csp',
    'content security policy',
    'content-security-policy',
    'csp builder',
    'csp analyzer',
    'unsafe-inline',
    'nonce',
    'script-src',
    'security headers',
  ],
  relatedToolIds: ['http-headers-parser', 'meta-tag-generator', 'cookie-parser'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const report = withToolError(() => webFunctions.analyzeCsp(text));
    const count = report.directives.length;
    const summary = `${count} ${count === 1 ? 'directive' : 'directives'} · ${webFunctions.summarizeFindings(report.findings)}`;

    if (fields.format === 'header') {
      return identityOutput(report.header, 'csp-header.txt', summary, false);
    }

    if (fields.format === 'meta') {
      const ignored = report.findings.some((f) => /ignored in a <meta>/.test(f.message))
        ? []
        : webFunctions.cspMetaIgnored(report);
      const note = ignored.length
        ? `\n<!-- Ignored in meta policies: ${ignored.join(', ')}. Send them as a header. -->`
        : '';

      return {
        ...identityOutput(`${report.meta}${note}`, 'csp-meta.html', summary, false),
        language: 'html',
      };
    }

    return identityOutput(webFunctions.renderCspReport(report), 'csp-report.txt', summary, false);
  },
};
