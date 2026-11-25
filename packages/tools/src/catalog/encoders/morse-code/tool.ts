import { ToolDefinition } from '@devtoolora/core';
import { morseToText, textToMorse } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const morseCodeTool: ToolDefinition = {
  id: 'morse-code',
  name: 'Morse Code Translator',
  category: 'Encoders',
  description:
    'Convert supported letters, digits and punctuation to dot/dash Morse notation and decode it to uppercase text.',
  samples: [
    { fields: { mode: 'encode' }, label: 'SOS', text: 'SOS' },
    { fields: { mode: 'decode' }, label: 'Decode SOS', text: '... --- ...' },
    { fields: { mode: 'encode' }, label: 'Two words', text: 'Hello world' },
    { fields: { mode: 'decode' }, label: 'Decode two words', text: '.... .. / - .... . .-. .' },
    { fields: { mode: 'encode' }, label: 'Numbers', text: '2026' },
    { fields: { mode: 'decode' }, label: 'Decode numbers', text: '.---- ..--- ...--' },
    { fields: { mode: 'encode' }, label: 'Punctuation', text: 'Hi, OK?' },
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
        { label: 'Text to Morse', value: 'encode' },
        { label: 'Morse to text', value: 'decode' },
      ],
    },
  ],
  keywords: ['morse', 'dots', 'dashes', 'sos', 'translator', 'encode', 'decode'],
  relatedToolIds: ['caesar-cipher', 'ascii-text'],
  textConversion: { decodedLabel: 'Text for Morse', encodedLabel: 'Morse dot/dash sequences' },
  run: ({ text, fields }) =>
    withToolError(() => ({
      text: conversionMode(fields) === 'decode' ? morseToText(text) : textToMorse(text),
      language: 'plaintext',
      summary: 'Morse text conversion complete · spaces between characters · / between words.',
    })),
};
