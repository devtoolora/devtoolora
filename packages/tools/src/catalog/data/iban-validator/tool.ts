import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { validateIban } from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

export const ibanValidatorTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Data',
  description:
    'Check an IBAN’s country format, exact length, BBAN structure and MOD 97-10 checksum offline.',
  fields: [
    {
      defaultValue: 'json',
      help: 'Report explains every check. Electronic and Print outputs are available only when every check passes.',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Report', value: 'json' },
        { label: 'Electronic', value: 'electronic' },
        { label: 'Print', value: 'print' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'iban-validator',
  inputKind: 'text',
  keywords: ['bank account', 'bban', 'mod 97', 'checksum', 'sepa', 'swift'],
  name: 'IBAN Validator',
  outputKind: 'json',
  relatedToolIds: ['phone-formatter', 'email-normalizer', 'number-formatter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.report || 'json';

      if (mode !== 'json' && mode !== 'electronic' && mode !== 'print')
        throw new ToolError('Choose Report, Electronic or Print output.');

      const report = validateIban(text);

      if (mode !== 'json' && !report.valid)
        throw new ToolError(
          'IBAN is invalid. Choose Report to inspect every check. ' + report.issues[0]?.message,
        );

      const output = {
        electronic: report.iban,
        json: JSON.stringify(report, null, 2),
        print: report.printFormat,
      }[mode];

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: mode === 'json' ? 'iban-report.json' : 'iban.txt',
          mimeType: mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: mode === 'json' ? 'json' : 'plaintext',
        summary: report.valid
          ? 'Passes all bundled IBAN format checks · not an account or ownership verification.'
          : `Invalid IBAN · ${report.issues.length} ${report.issues.length === 1 ? 'issue' : 'issues'} · see checks and issues in the report.`,
        text: output,
      };
    }),
  samples: [
    { fields: { report: 'json' }, label: 'Valid example', text: 'GB82 WEST 1234 5698 7654 32' },
    {
      fields: { report: 'electronic' },
      label: 'Czech registry example',
      text: 'CZ65 0800 0000 1920 0014 5399',
    },
    {
      fields: { report: 'print' },
      label: 'French alphanumeric BBAN',
      text: 'FR1420041010050500013M02606',
    },
    {
      fields: { report: 'json' },
      label: 'Brazil 2026 format',
      text: 'BR66 9999 9A03 0000 1000 9795 493C 1',
    },
    {
      fields: { report: 'json' },
      label: 'Wrong check digits',
      text: 'GB83 WEST 1234 5698 7654 32',
    },
    {
      fields: { report: 'json' },
      label: 'Wrong country length',
      text: 'GB82 WEST 1234 5698 7654 320',
    },
  ],
  supportsSelection: true,
};
