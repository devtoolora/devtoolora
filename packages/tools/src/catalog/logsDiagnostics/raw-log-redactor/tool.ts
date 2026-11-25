import { ToolDefinition } from '@devtoolora/core';
import { redactLogText } from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities, logOutput } from '../shared';

export const rawLogRedactorTool: ToolDefinition = {
  id: 'raw-log-redactor',
  name: 'Raw Log Redactor',
  category: 'Logs & Diagnostics',
  description: 'Mask credentials and tokens in raw logs before sharing them.',
  samples: [
    { label: 'Authorization header', text: 'Authorization: Bearer demo-token\nuser=ada' },
    { label: 'Query parameter', text: 'GET /v1?api_key=demo-key&page=1' },
    { label: 'Password field', text: 'password=demo\nuser=ada' },
    { label: 'Quoted JSON', text: '{"token":"demo\\\"secret","user":"ada"}' },
    {
      fields: { additionalNames: 'DATABASE_URL' },
      label: 'Custom connection name',
      text: 'DATABASE_URL=postgres://demo:demo@localhost/app',
    },
    {
      label: 'Escaped and single-quoted JSON',
      text: '{\\"password\\":\\"demo\\",\\"user\\":\\"ada\\"}\n{\'api_key\': \'demo\', \'user\': \'ada\'}',
    },
    { label: 'URL credentials', text: 'connect postgres://admin:demo@db.example.com/app' },
    { label: 'Cookie header', text: 'Cookie: sessionid=demo; tracking=demo\nINFO done' },
    {
      label: 'Compound key names',
      text: 'github_token=demo\nuser_password: demo\n{"api_token": "demo"}\ntokenizer=on',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  fields: [
    {
      id: 'additionalNames',
      label: 'Additional sensitive names',
      type: 'text',
      placeholder: 'SENTRY_DSN, DATABASE_URL',
    },
  ],
  keywords: ['logs', 'redact', 'token', 'authorization', 'cookie', 'jwt', 'secrets'],
  relatedToolIds: ['secret-redactor', 'log-filter', 'json-lines-inspector', 'regex-test'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const result = redactLogText(text, fields.additionalNames ?? '');

      return logOutput(
        result.text,
        'redacted.log',
        'plaintext',
        withWarning(
          `${result.redactions} redaction substitution${result.redactions === 1 ? '' : 's'} · heuristic only; review remaining text.`,
          result.warning,
        ),
      );
    }),
};
