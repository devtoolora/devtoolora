import { ToolDefinition } from '@devtoolora/core';
import { formatDotenv, parseDotenv, type DotenvDocument } from '@devtoolora/functions/config';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, configResult, commonSamples } from '../shared';

function attachedCommentWarning(document: DotenvDocument): string {
  const count = document.lines.filter(
    (line) => line.kind === 'assignment' && line.attachedComment,
  ).length;

  if (count === 0) return '';

  return ` ${count} # without a space before ${count === 1 ? 'it was' : 'them were'} read as a comment; sh and other dotenv readers keep it in the value, so quote the value if it belongs there.`;
}

export const dotenvFormatterTool: ToolDefinition = {
  id: 'dotenv-formatter',
  name: '.env Formatter',
  category: 'Config & Secrets',
  description: 'Clean common dotenv syntax while preserving order, comments and grouping.',
  samples: commonSamples
    .filter((sample) => sample.label !== 'Duplicate variable diagnostic')
    .concat({ label: 'Final newline absent', text: 'PORT = 3000' }),
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  keywords: ['dotenv', 'env file', 'environment variables', 'config format'],
  relatedToolIds: ['dotenv-validator', 'secret-redactor', 'json-format'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() => {
      const document = parseDotenv(text);

      return configResult(
        formatDotenv(document),
        'formatted.env',
        `Formatted locally · values, including secrets, are preserved.${attachedCommentWarning(document)}`,
      );
    }),
};
