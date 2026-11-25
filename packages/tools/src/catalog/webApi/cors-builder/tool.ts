import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const base = {
  allowHeaders: '',
  credentials: 'false',
  exposeHeaders: '',
  maxAge: '',
  methods: 'GET,POST',
  origins: 'https://app.example.com',
  privateNetwork: 'false',
};

const methodNames = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export const corsBuilderTool: ToolDefinition = {
  id: 'cors-builder',
  name: 'CORS Header Builder',
  category: 'Web/API',
  description:
    'Build the preflight and actual-response CORS headers for your origins, methods and headers, with findings for risky combinations.',
  samples: [
    {
      fields: {
        ...base,
        allowHeaders: 'Content-Type, Authorization',
        maxAge: '600',
      },
      label: 'Single app origin',
    },
    {
      fields: { ...base, methods: 'GET,HEAD', origins: '*' },
      label: 'Public API',
    },
    {
      fields: {
        ...base,
        allowHeaders: 'Content-Type, Authorization',
        credentials: 'true',
        methods: 'GET,POST,PUT,DELETE',
        origins: 'https://app.example.com\nhttps://admin.example.com',
      },
      label: 'Credentials with two origins',
    },
    {
      fields: { ...base, methods: 'GET,POST,OPTIONS', privateNetwork: 'true' },
      label: 'Private network',
    },
    {
      fields: { ...base, exposeHeaders: 'X-Request-Id, ETag' },
      label: 'Exposed headers',
    },
    {
      fields: { ...base, maxAge: '86400' },
      label: 'Long max age',
    },
  ],
  inputKind: 'none',
  outputKind: 'text',
  autoRun: true,
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'https://app.example.com',
      help: 'One per line: *, null or scheme://host[:port].',
      id: 'origins',
      label: 'Allowed origins',
      required: true,
      type: 'textarea',
    },
    {
      defaultValue: 'GET,POST',
      id: 'methods',
      label: 'Methods',
      options: methodNames.map((method) => ({ label: method, value: method })),
      type: 'checkboxGroup',
    },
    {
      defaultValue: 'Content-Type, Authorization',
      id: 'allowHeaders',
      label: 'Allowed request headers',
      type: 'text',
    },
    { defaultValue: '', id: 'exposeHeaders', label: 'Exposed response headers', type: 'text' },
    { defaultValue: 'false', id: 'credentials', label: 'Allow credentials', type: 'checkbox' },
    { defaultValue: '600', id: 'maxAge', label: 'Max age (seconds)', type: 'number' },
    {
      defaultValue: 'false',
      id: 'privateNetwork',
      label: 'Allow private network',
      type: 'checkbox',
    },
  ],
  keywords: [
    'cors',
    'cross-origin',
    'access-control-allow-origin',
    'preflight',
    'options request',
    'cors headers',
    'allow credentials',
    'vary origin',
  ],
  relatedToolIds: ['http-headers-parser', 'http-request-builder', 'csp-analyzer'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => {
    const report = withToolError(() =>
      webFunctions.buildCorsHeaders({
        allowHeaders: fields.allowHeaders,
        credentials: fields.credentials === 'true',
        exposeHeaders: fields.exposeHeaders,
        maxAge: fields.maxAge,
        methods: fields.methods,
        origins: fields.origins ?? '',
        privateNetwork: fields.privateNetwork === 'true',
      }),
    );
    const methods =
      report.preflight.find((header) => header.name === 'Access-Control-Allow-Methods')?.value ??
      '';
    const summary = [
      plural(report.origins.length, 'origin'),
      plural(methods.split(', ').length, 'method'),
      report.preflightRequired ? 'preflight required' : 'no preflight for simple requests',
      webFunctions.summarizeFindings(report.findings),
    ].join(' · ');

    return identityOutput(report.text, 'cors-headers.txt', summary, false);
  },
};
