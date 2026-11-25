import { ToolDefinition } from '@devtoolora/core';
import {
  encodeBase64Text,
  normalizeUnicode,
  type NormalizationForm,
} from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const forms: readonly NormalizationForm[] = ['NFC', 'NFD', 'NFKC', 'NFKD'];
const previews = ['text', 'report'] as const;

export const unicodeNormalizerTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Normalize text to NFC, NFD, NFKC or NFKD and see exactly which graphemes and code points changed.',
  fields: [
    {
      defaultValue: 'NFC',
      id: 'form',
      label: 'Form',
      options: [
        { label: 'NFC (compose)', value: 'NFC' },
        { label: 'NFD (decompose)', value: 'NFD' },
        { label: 'NFKC (compatibility compose)', value: 'NFKC' },
        { label: 'NFKD (compatibility decompose)', value: 'NFKD' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'text',
      id: 'preview',
      label: 'Preview',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Report', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'unicode-normalizer',
  inputKind: 'optionalText',
  keywords: ['unicode', 'normalize', 'nfc', 'nfd', 'nfkc', 'nfkd', 'composed', 'decomposed'],
  name: 'Unicode Normalizer',
  outputKind: 'text',
  relatedToolIds: ['strip-diacritics', 'unicode-escape', 'zero-width-detector', 'case-convert'],
  requiresInput: false,
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const form = choiceField(fields.form, 'NFC', forms, 'Choose NFC, NFD, NFKC or NFKD.');
      const preview = choiceField(fields.preview, 'text', previews, 'Choose Text or Report.');
      const result = normalizeUnicode(text, form);
      const report = preview === 'report';
      const output = report
        ? JSON.stringify(
            {
              changes: result.changes,
              counts: {
                changedGraphemes: result.changedGraphemes,
                inputCodePoints: result.inputCodePoints,
                outputCodePoints: result.outputCodePoints,
              },
              form,
            },
            null,
            2,
          )
        : result.text;

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: report ? 'normalization-report.json' : 'normalized.txt',
          mimeType: report ? 'application/json' : 'text/plain;charset=utf-8',
        },
        language: report ? 'json' : 'plaintext',
        summary: `${form} · ${result.changedGraphemes} graphemes changed · ${result.inputCodePoints} → ${result.outputCodePoints} code points`,
        text: output,
      };
    }),
  samples: [
    {
      fields: { form: 'NFC', preview: 'text' },
      label: 'Compose decomposed accents (NFC)',
      text: 'cafe\u0301 nai\u0308ve',
    },
    {
      fields: { form: 'NFD', preview: 'report' },
      label: 'Decompose for comparison (NFD)',
      text: 'caf\u00e9',
    },
    {
      fields: { form: 'NFKC', preview: 'text' },
      label: 'Ligatures and width (NFKC)',
      text: '\ufb01le \uff21\uff22\uff23',
    },
    {
      fields: { form: 'NFKD', preview: 'text' },
      label: 'Circled digits (NFKD)',
      text: '\u2460\u2461\u2462',
    },
    {
      fields: { form: 'NFC', preview: 'text' },
      label: 'Already normalized',
      text: 'caf\u00e9',
    },
    { fields: { form: 'NFC', preview: 'text' }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
};
