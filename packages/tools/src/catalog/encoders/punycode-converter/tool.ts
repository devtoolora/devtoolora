import { ToolDefinition } from '@devtoolora/core';
import { convertDomains } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

export const punycodeConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Convert internationalized domain names between Unicode and xn-- Punycode and flag mixed-script homograph labels.',
  fields: [
    {
      defaultValue: 'toAscii',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'To ASCII (xn--)', value: 'toAscii' },
        { label: 'To Unicode', value: 'toUnicode' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'punycode-converter',
  inputKind: 'text',
  keywords: ['punycode', 'idn', 'idna', 'xn--', 'domain', 'unicode', 'homograph', 'rfc 3492'],
  name: 'Punycode Converter',
  outputKind: 'text',
  relatedToolIds: ['url-parse', 'email-normalizer', 'unicode-normalizer'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = choiceField(
        fields.mode,
        'toAscii',
        ['toAscii', 'toUnicode'],
        'Choose To ASCII or To Unicode.',
      );
      const rows = convertDomains(text, mode);
      const warnings = rows.filter((row) => row.warning).length;
      const domains = `${rows.length} ${rows.length === 1 ? 'domain' : 'domains'}`;
      const flagged = `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`;

      return {
        jsonTable: {
          columns: ['Input', 'Output', 'Warning'],
          rows: rows.map((row) => [row.input, row.output, row.warning ?? null]),
        },
        language: 'plaintext',
        summary: warnings > 0 ? `${domains} \u00b7 ${flagged}` : domains,
        text: rows.map((row) => row.output).join('\n'),
      };
    }),
  samples: [
    { fields: { mode: 'toAscii' }, label: 'German umlaut', text: 'münchen.de' },
    { fields: { mode: 'toAscii' }, label: 'Several domains', text: 'Bücher.DE\ncafé.example' },
    {
      fields: { mode: 'toAscii' },
      label: 'Japanese with ideographic dot',
      text: '\u4F8B\u3048\u3002\u30C6\u30B9\u30C8',
    },
    { fields: { mode: 'toAscii' }, label: 'Email address', text: 'user@münchen.de' },
    { fields: { mode: 'toAscii' }, label: 'Cyrillic homograph', text: 'p\u0430ypal.com' },
    {
      fields: { mode: 'toUnicode' },
      label: 'Decode xn-- labels',
      text: 'xn--mnchen-3ya.de\nxn--bcher-kva.example',
    },
  ],
  supportsSelection: true,
};
