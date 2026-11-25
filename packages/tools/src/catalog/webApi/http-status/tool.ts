import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const httpStatusTool: ToolDefinition = {
  id: 'http-status',
  keywords: ['status code', '404', '500', 'response code', 'http error'],
  name: 'HTTP Status Lookup',
  category: 'Web/API',
  description: 'Look up common HTTP status codes.',
  samples: [
    { label: 'Browse all bundled codes', text: '' },
    { label: '404 Not Found', text: '404' },
    { label: '418 unused / historical teapot', text: '418' },
    { label: '503 Service Unavailable', text: '503' },
    { label: '308 Permanent Redirect', text: '308' },
    { label: 'Unknown bundled code', text: '499' },
  ],
  inputKind: 'optionalText',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  autoRun: true,
  resultActions: ['copy', 'scratch', 'save'],
  relatedToolIds: ['http-headers-parser', 'raw-http-request-inspector'],
  run: ({ text }) => lookupHttpStatus(text),
};

function lookupHttpStatus(text: string): ToolResult {
  return identityOutput(
    webFunctions.lookupHttpStatus(text).join('\n').trimEnd(),
    'http-status-reference.txt',
    'Bundled common-code reference · not a live server check or complete registry.',
    false,
  );
}
