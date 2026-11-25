import { ToolDefinition } from '@devtoolora/core';
import { binaryToText, textToBinary } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const textBinaryTool: ToolDefinition = {
  id: 'text-binary',
  name: 'Text ↔ Binary',
  category: 'Encoders',
  description: 'Convert UTF-8 text to binary bytes or binary bytes back to text.',
  samples: [
    { fields: { mode: 'encode' }, label: 'Hello', text: 'Hello' },
    { fields: { mode: 'decode' }, label: 'Decode letter A', text: '01000001' },
    { fields: { mode: 'encode' }, label: 'UTF-8 character', text: 'č' },
    { fields: { mode: 'encode' }, label: 'Emoji bytes', text: '🐎' },
    { fields: { mode: 'decode' }, label: 'Line-separated bytes', text: '01001111\n01001011' },
    {
      fields: { mode: 'decode' },
      label: 'Decode accented word',
      text: '11000100 10001101 01100001 01110101',
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
        { label: 'Text to binary', value: 'encode' },
        { label: 'Binary to text', value: 'decode' },
      ],
    },
  ],
  keywords: ['binary', 'bits', 'bytes', 'utf-8', 'text', 'encode', 'decode'],
  relatedToolIds: ['hex-text', 'ascii-text', 'base64-encode'],
  textConversion: { decodedLabel: 'UTF-8 text', encodedLabel: 'Binary bytes' },
  run: ({ text, fields }) =>
    withToolError(() => ({
      text: conversionMode(fields) === 'decode' ? binaryToText(text) : textToBinary(text),
      language: 'plaintext',
      summary: 'UTF-8 binary conversion complete · 8 bits per byte.',
    })),
};
