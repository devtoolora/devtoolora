import { ToolDefinition } from '@devtoolora/core';
import { asciiToText, textToAscii } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const asciiTextTool: ToolDefinition = {
  id: 'ascii-text',
  name: 'ASCII/Text Converter',
  category: 'Encoders',
  description:
    'Convert 7-bit ASCII text to whitespace-separated decimal codes from 0 to 127 and back.',
  samples: [
    { fields: { mode: 'encode' }, label: 'ABC', text: 'ABC' },
    { fields: { mode: 'decode' }, label: 'Decode greeting', text: '72 105' },
    { fields: { mode: 'encode' }, label: 'Space and newline', text: 'A \n' },
    { fields: { mode: 'encode' }, label: 'Digits as characters', text: '2026' },
    { fields: { mode: 'encode' }, label: 'JSON punctuation', text: '{"id":1}' },
    { fields: { mode: 'decode' }, label: 'Mixed whitespace', text: '72 101\n108\t108 111' },
    { fields: { mode: 'decode' }, label: 'Zero-padded codes', text: '072 101 121' },
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
        { label: 'Text to ASCII', value: 'encode' },
        { label: 'ASCII to text', value: 'decode' },
      ],
    },
  ],
  keywords: ['ascii', 'decimal', 'character codes', '7-bit', 'text', 'encode', 'decode'],
  relatedToolIds: ['hex-text', 'text-binary', 'unicode-escape'],
  textConversion: { decodedLabel: 'ASCII text', encodedLabel: 'Decimal ASCII codes' },
  run: ({ text, fields }) =>
    withToolError(() => ({
      text: conversionMode(fields) === 'decode' ? asciiToText(text) : textToAscii(text),
      language: 'plaintext',
      summary: 'ASCII conversion complete · decimal codes 0–127.',
    })),
};
