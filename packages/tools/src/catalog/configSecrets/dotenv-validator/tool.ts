import { ToolDefinition } from '@devtoolora/core';
import { inspectDotenv, listDotenvDiagnostics } from '@devtoolora/functions/config';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, configResult, commonSamples } from '../shared';

export const dotenvValidatorTool: ToolDefinition = {
  id: 'dotenv-validator',
  name: '.env Validator',
  category: 'Config & Secrets',
  description: 'Check dotenv syntax, duplicate names and common assignment mistakes.',
  samples: commonSamples,
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  keywords: ['dotenv', 'env file', 'environment variables', 'validate config'],
  relatedToolIds: ['dotenv-formatter', 'secret-redactor', 'json-format'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() => {
      const document = inspectDotenv(text);
      const assignments = document.lines.filter((line) => line.kind === 'assignment');
      const variables = new Set(assignments.map((line) => line.key)).size;

      if (document.diagnostics.length === 0) {
        return configResult(
          `Valid .env\nVariables: ${variables}\nAssignments: ${assignments.length}`,
          'dotenv-validation.txt',
          '.env syntax is valid · application values and references were not checked.',
        );
      }

      return configResult(
        [
          'Invalid .env',
          '',
          ...listDotenvDiagnostics(document.diagnostics).map((item) => `- ${item}`),
        ].join('\n'),
        'dotenv-validation.txt',
        `.env has ${document.diagnostics.length} issue${document.diagnostics.length === 1 ? '' : 's'}.`,
      );
    }),
};
