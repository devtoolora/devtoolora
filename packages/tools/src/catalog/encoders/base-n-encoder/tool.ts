import { ToolDefinition } from '@devtoolora/core';
import {
  decodeBaseNText,
  encodeBaseNText,
  type BaseNAlphabet,
} from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, conversionMode } from '../shared';

const alphabets: readonly BaseNAlphabet[] = ['base32', 'base32hex', 'base58', 'base45', 'ascii85'];

export const baseNEncoderTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Encode UTF-8 text as Base32, Base32hex, Base58 (Bitcoin), Base45 or Ascii85, or decode it back to text.',
  fields: [
    {
      defaultValue: 'base32',
      id: 'base',
      label: 'Base',
      options: [
        { label: 'Base32 (RFC 4648)', value: 'base32' },
        { label: 'Base32hex', value: 'base32hex' },
        { label: 'Base58 (Bitcoin)', value: 'base58' },
        { label: 'Base45 (RFC 9285)', value: 'base45' },
        { label: 'Ascii85', value: 'ascii85' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'encode',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Encode', value: 'encode' },
        { label: 'Decode', value: 'decode' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'base-n-encoder',
  inputKind: 'text',
  keywords: [
    'base32',
    'base32hex',
    'base58',
    'base45',
    'ascii85',
    'base85',
    'bitcoin',
    'rfc 4648',
    'rfc 9285',
    'encode',
    'decode',
  ],
  name: 'Base-N Encoder',
  outputKind: 'text',
  relatedToolIds: ['base64-encode', 'hex-text', 'text-binary', 'url-encode'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const alphabet = choiceField(
        fields.base,
        'base32',
        alphabets,
        'Choose Base32, Base32hex, Base58, Base45 or Ascii85.',
      );
      const mode = conversionMode(fields);
      const output =
        mode === 'decode' ? decodeBaseNText(text, alphabet) : encodeBaseNText(text, alphabet);
      const bytes = new TextEncoder().encode(mode === 'decode' ? output : text).length;

      return {
        language: 'plaintext',
        summary: `${mode} · ${alphabet} · ${bytes} bytes`,
        text: output,
      };
    }),
  samples: [
    { fields: { base: 'base32', mode: 'encode' }, label: 'Base32 of foobar', text: 'foobar' },
    {
      fields: { base: 'base32', mode: 'decode' },
      label: 'Decode unpadded Base32',
      text: 'MZXW6YTBOI',
    },
    {
      fields: { base: 'base58', mode: 'encode' },
      label: 'Base58 address-style',
      text: 'Hello World!',
    },
    {
      fields: { base: 'base45', mode: 'encode' },
      label: 'Base45 for QR payloads',
      text: 'Hello!!',
    },
    {
      fields: { base: 'ascii85', mode: 'decode' },
      label: 'Ascii85 with wrappers',
      text: '<~87cURD_*#4DfTZ)~>',
    },
    { fields: { base: 'base32hex', mode: 'encode' }, label: 'Base32hex', text: 'foobar' },
  ],
  supportsSelection: true,
  textConversion: { decodedLabel: 'UTF-8 text', encodedLabel: 'Encoded text' },
};

function baseAlias(id: string, name: string, base: BaseNAlphabet): ToolDefinition {
  return {
    ...baseNEncoderTool,
    aliasOf: 'base-n-encoder',
    fields: baseNEncoderTool.fields?.map((field) =>
      field.id === 'base' ? { ...field, defaultValue: base } : field,
    ),
    id,
    name,
    run: (input) => baseNEncoderTool.run({ ...input, fields: { base, ...input.fields } }),
  };
}

export const base32EncodeTool = baseAlias('base32-encode', 'Base32 Encode / Decode', 'base32');
export const base58EncodeTool = baseAlias('base58-encode', 'Base58 Encode / Decode', 'base58');
export const base45EncodeTool = baseAlias('base45-encode', 'Base45 Encode / Decode', 'base45');
export const ascii85EncodeTool = baseAlias('ascii85-encode', 'Ascii85 Encode / Decode', 'ascii85');
