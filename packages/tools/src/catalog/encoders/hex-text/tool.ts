import { ToolDefinition } from '@devtoolora/core';
import { hexToText, textToHex } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const hexTextTool: ToolDefinition = {
  id: 'hex-text',
  name: 'Hex/Text Converter',
  category: 'Encoders',
  description: 'Convert UTF-8 text to hexadecimal bytes or decode hex back to text.',
  samples: [
    { fields: { mode: 'encode' }, label: 'Hello', text: 'Hello' },
    { fields: { mode: 'decode' }, label: 'Decode greeting', text: '48 69' },
    { fields: { mode: 'decode' }, label: 'Compact UTF-8 bytes', text: 'C48D' },
    { fields: { mode: 'encode' }, label: 'Accented text', text: 'Café' },
    { fields: { mode: 'encode' }, label: 'Emoji bytes', text: '🐎' },
    { fields: { mode: 'decode' }, label: 'Uppercase hex bytes', text: '4F 4B 21' },
    {
      fields: { mode: 'decode' },
      label: 'Line-wrapped bytes',
      text: '7b 22 6f 6b 22\n3a 74 72 75 65 7d',
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      id: 'mode',
      label: 'Mode',
      type: 'select',
      presentation: 'segmented',
      defaultValue: 'encode',
      options: [
        { label: 'Text to hex', value: 'encode' },
        { label: 'Hex to text', value: 'decode' },
      ],
    },
  ],
  keywords: ['hex', 'hexadecimal', 'bytes', 'utf-8', 'text', 'encode', 'decode'],
  relatedToolIds: ['text-binary', 'unicode-escape', 'base64-encode'],
  textConversion: { decodedLabel: 'UTF-8 text', encodedLabel: 'Hexadecimal bytes' },
  run: ({ text, fields }) =>
    withToolError(() => ({
      text: conversionMode(fields) === 'decode' ? hexToText(text) : textToHex(text),
      language: 'plaintext',
      summary: 'UTF-8 hex conversion complete · 2 hexadecimal digits per byte.',
    })),
};
