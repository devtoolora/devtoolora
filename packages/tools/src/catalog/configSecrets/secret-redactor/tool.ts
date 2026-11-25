import { ToolDefinition } from '@devtoolora/core';
import { parseDotenv, redactDotenv } from '@devtoolora/functions/config';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, configResult } from '../shared';

export const secretRedactorTool: ToolDefinition = {
  id: 'secret-redactor',
  name: 'Secret Redactor',
  category: 'Config & Secrets',
  description: 'Mask sensitive dotenv values before sharing configuration files.',
  samples: [
    {
      fields: { additionalNames: 'DATABASE_URL', removeComments: 'true' },
      label: 'Connection string',
      text: 'PORT=3000\nAPI_TOKEN=demo\nDATABASE_URL=postgres://demo:demo@localhost/app\n',
    },
    {
      fields: { additionalNames: '', removeComments: 'true' },
      label: 'Conventional names',
      text: 'PASSWORD=demo\nPRIVATE=demo\nAPI_KEY=demo\n',
    },
    {
      fields: { additionalNames: '', removeComments: 'true' },
      label: 'Strip secret comments',
      text: '# demo credential\nPORT=3000 # demo note\nTOKEN=demo # demo token\n',
    },
    {
      fields: { additionalNames: '', removeComments: 'false' },
      label: 'Preserve reviewed comments',
      text: '# public note\nTOKEN=demo\n',
    },
    {
      fields: { additionalNames: 'ServiceCredential', removeComments: 'true' },
      label: 'Exact custom name',
      text: 'ServiceCredential=demo\nPUBLIC_NAME=example\n',
    },
    {
      fields: { additionalNames: '', removeComments: 'true' },
      label: 'Quoted value',
      text: 'SECRET="demo # secret"\nEMPTY=\n',
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
      help: 'Comma-separated exact names; case-sensitive.',
      id: 'additionalNames',
      label: 'Additional sensitive names',
      type: 'text',
      placeholder: 'DATABASE_URL, SENTRY_DSN',
    },
    {
      defaultValue: 'true',
      help: 'Remove both full-line and inline comments; comments can contain credentials.',
      id: 'removeComments',
      label: 'Remove comments',
      type: 'checkbox',
    },
  ],
  keywords: ['dotenv', 'env file', 'mask secrets', 'redact token', 'redact password'],
  relatedToolIds: ['dotenv-formatter', 'dotenv-validator', 'text-statistics'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() =>
      configResult(
        redactDotenv(
          parseDotenv(text),
          fields.additionalNames ?? '',
          fields.removeComments !== 'false',
        ),
        'redacted.env',
        'Name-based redaction only · review all remaining values before sharing.',
      ),
    ),
};
