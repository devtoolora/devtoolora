import { ToolDefinition, ToolError } from '@devtoolora/core';
import * as dataFunctions from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolErrorAsync } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const phoneFormatterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Data',
  description:
    'Validate a complete phone number and format it as E.164, national, international or a tel: URI.',
  fields: [
    {
      defaultValue: 'US',
      help: 'Used for national numbers and local international dialing prefixes. A leading + overrides the default. Country names are in English.',
      id: 'countryCode',
      label: 'Default country',
      options: [
        { label: 'International only (+ required)', value: 'international' },
        ...dataFunctions.listPhoneRegions().map((region: dataFunctions.PhoneRegion) => ({
          label: `${region.label} (${region.code}, +${region.callingCode})`,
          value: region.code,
        })),
      ],
      type: 'select',
    },
    {
      defaultValue: 'json',
      help: 'E.164 excludes the extension. The report and tel: URI preserve it.',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Report', value: 'json' },
        { label: 'E.164', value: 'e164' },
        { label: 'International', value: 'international' },
        { label: 'National', value: 'national' },
        { label: 'tel: URI', value: 'uri' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'phone-formatter',
  inputKind: 'text',
  keywords: ['phone number', 'telephone', 'e.164', 'international', 'tel uri', 'mobile'],
  name: 'Phone Formatter',
  outputKind: 'json',
  relatedToolIds: ['email-normalizer', 'iban-validator', 'fake-data-generator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolErrorAsync(async () => {
      const report = await dataFunctions.formatPhone(text, fields.countryCode || 'US');
      const mode = fields.report || 'json';

      if (
        mode !== 'json' &&
        mode !== 'e164' &&
        mode !== 'international' &&
        mode !== 'national' &&
        mode !== 'uri'
      )
        throw new ToolError('Choose Report, E.164, International, National or tel: URI output.');

      const output = mode === 'json' ? JSON.stringify(report, null, 2) : report[mode];

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: mode === 'json' ? 'phone-report.json' : 'phone-number.txt',
          mimeType: mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: mode === 'json' ? 'json' : 'plaintext',
        summary: `Matches bundled numbering rules · ${report.country ?? 'non-geographic or undetermined'} · not a reachability check.`,
        text: output,
      };
    }),
  samples: [
    { fields: { countryCode: 'US', report: 'json' }, label: 'US number', text: '(415) 555-0134' },
    {
      fields: { countryCode: 'CZ', report: 'e164' },
      label: 'Czech national number',
      text: '601 123 456',
    },
    {
      fields: { countryCode: 'GB', report: 'json' },
      label: 'UK trunk prefix',
      text: '020 7946 0018',
    },
    {
      fields: { countryCode: 'IT', report: 'json' },
      label: 'Italy significant zero',
      text: '02 1234 5678',
    },
    {
      fields: { countryCode: 'US', report: 'international' },
      label: 'International overrides default',
      text: '+44 20 7946 0018',
    },
    {
      fields: { countryCode: 'international', report: 'uri' },
      label: 'Desk extension',
      text: '+1 415 555 0134 ext. 123',
    },
  ],
  supportsSelection: true,
};
