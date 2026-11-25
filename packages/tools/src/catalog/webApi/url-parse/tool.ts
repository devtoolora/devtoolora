import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const urlParseTool: ToolDefinition = {
  id: 'url-parse',
  keywords: ['url', 'uri', 'hostname', 'path', 'query parameters', 'parse url'],
  name: 'URL Parser',
  category: 'Web/API',
  description: 'Break a URL into protocol, host, path and query params.',
  samples: [
    { label: 'URL with query', text: 'https://example.com:8443/path?q=1#top' },
    { label: 'Repeated parameters', text: 'https://example.com/search?tag=a&tag=b' },
    {
      label: 'Encoded plus versus space',
      text: 'https://example.com/?space=dev+tools&plus=dev%2Btools',
    },
    { label: 'Credential password', text: 'https://demo:demo-password@example.com/' },
    { label: 'Default port', text: 'https://example.com:443/' },
    { label: 'IPv6 host', text: 'http://[::1]:8080/path' },
  ],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  relatedToolIds: ['url-encode', 'query-string-parser'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() =>
      identityOutput(
        JSON.stringify(webFunctions.inspectUrl(text), null, 2),
        'url-report.json',
        'Parsed components · password masked; query/path/fragment are not redacted.',
        true,
      ),
    ),
};
