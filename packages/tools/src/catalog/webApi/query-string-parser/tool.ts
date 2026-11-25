import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { duplicateKeysWarning, parseExactJson } from '@devtoolora/functions/format';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const queryStringParserTool: ToolDefinition = {
  id: 'query-string-parser',
  keywords: ['query string', 'url params', 'search params', 'urlencoded', 'json'],
  name: 'Query String Parser',
  category: 'Web/API',
  description: 'Convert URL query strings to JSON and JSON objects back to query strings.',
  samples: [
    {
      fields: { mode: 'parse' },
      label: 'Parse URL query',
      text: 'https://example.com/search?q=dev+tools&page=2&q=local',
    },
    { fields: { mode: 'stringify' }, label: 'Build query', text: '{"q":"dev tools","page":2}' },
    { fields: { mode: 'parse' }, label: 'Literal question mark', text: 'q=a?b&empty=' },
    {
      fields: { mode: 'parse' },
      label: 'Prototype-like names',
      text: '__proto__=one&__proto__=two&constructor=demo',
    },
    {
      fields: { mode: 'stringify' },
      label: 'Repeated and nullable values',
      text: '{"tag":["a","b"],"skip":null,"active":true}',
    },
    {
      fields: { mode: 'parse' },
      label: 'No query in full URL',
      text: 'https://example.com/path#fragment',
    },
  ],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  relatedToolIds: ['url-parse', 'url-encode'],
  fields: [
    {
      id: 'mode',
      label: 'Mode',
      type: 'select',
      defaultValue: 'parse',
      options: [
        { label: 'Parse to JSON', value: 'parse' },
        { label: 'JSON to query', value: 'stringify' },
      ],
    },
  ],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ text, fields }) => parseQueryString(text, fields.mode || 'parse'),
};

function parseQueryString(text: string, mode: string): ToolResult {
  if (mode !== 'parse' && mode !== 'stringify')
    throw new ToolError('Choose Parse to JSON or JSON to query.');
  if (text.length > 1_048_576) throw new ToolError('Query input exceeds 1,048,576 characters.');

  if (mode === 'stringify') {
    const { duplicates, value } = withToolError(() => parseExactJson(text));
    const result = withToolError(() => webFunctions.stringifyQueryString(value));

    return identityOutput(
      result,
      'query-string.txt',
      withWarning(
        'Form-encoded query · null values omitted; no redaction.',
        duplicateKeysWarning(duplicates),
      ),
      false,
    );
  }

  return identityOutput(
    JSON.stringify(
      withToolError(() => webFunctions.parseQueryString(text)),
      null,
      2,
    ),
    'query-report.json',
    'Decoded string values · repeated names grouped into arrays.',
    true,
  );
}
