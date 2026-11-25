import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const hardened = [
  'HTTP/2 200',
  'strict-transport-security: max-age=63072000; includeSubDomains; preload',
  "content-security-policy: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'x-content-type-options: nosniff',
  'referrer-policy: strict-origin-when-cross-origin',
  'permissions-policy: camera=(), microphone=()',
  'cross-origin-opener-policy: same-origin',
  'cross-origin-resource-policy: same-origin',
].join('\n');

export const securityHeadersAnalyzerTool: ToolDefinition = {
  id: 'security-headers-analyzer',
  name: 'Security Headers Analyzer',
  category: 'Web/API',
  description:
    'Grade a pasted HTTP response header block for HSTS, CSP, framing, referrer, permissions and cookie settings.',
  samples: [
    { fields: { format: 'report' }, label: 'Hardened response (A+)', text: hardened },
    {
      fields: { format: 'report' },
      label: 'Default server response (F)',
      text: 'HTTP/1.1 200 OK\ncontent-type: text/html\nserver: Apache',
    },
    {
      fields: { format: 'report' },
      label: 'CSP with unsafe-inline',
      text: "content-security-policy: default-src 'self' 'unsafe-inline'\nx-content-type-options: nosniff",
    },
    {
      fields: { format: 'report' },
      label: 'Short HSTS and ALLOW-FROM',
      text: 'strict-transport-security: max-age=300\nx-frame-options: ALLOW-FROM https://a.example',
    },
    {
      fields: { format: 'json' },
      label: 'Cookie without flags',
      text: 'HTTP/1.1 200 OK\nset-cookie: sid=abc; SameSite=None',
    },
    {
      fields: { format: 'report' },
      label: 'Version disclosure',
      text: 'server: nginx/1.25.3\nx-powered-by: Express 4.18\nx-xss-protection: 1; mode=block',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  sensitiveInput: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'report',
      id: 'format',
      label: 'Output',
      options: [
        { label: 'Report', value: 'report' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: [
    'security headers',
    'hsts',
    'strict-transport-security',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'header grade',
  ],
  relatedToolIds: ['http-headers-parser', 'csp-analyzer', 'cookie-parser'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const report = withToolError(() => webFunctions.analyzeSecurityHeaders(text));
    const warnings = `${report.warnings} ${report.warnings === 1 ? 'warning' : 'warnings'}`;
    const summary = `Grade ${report.grade} · ${report.gradedPresent} of 6 graded headers · ${warnings}`;

    if (fields.format === 'json') {
      return identityOutput(
        JSON.stringify(report, null, 2),
        'security-headers.json',
        summary,
        true,
      );
    }

    return identityOutput(
      webFunctions.renderSecurityHeadersReport(report),
      'security-headers.txt',
      summary,
      false,
    );
  },
};
