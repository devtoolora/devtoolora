import { ToolDefinition, ToolError } from '@devtoolora/core';
import { decodeUrlText, encodeUrlText } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

const urlContextLabels: Record<'component' | 'url' | 'form', string> = {
  component: 'URL component',
  form: 'form value',
  url: 'complete URL',
};

export const urlEncodeTool: ToolDefinition = {
  id: 'url-encode',
  name: 'URL Encode / Decode',
  category: 'Encoders',
  description:
    'Encode or decode URL components, complete URLs and form values with explicit space and plus handling.',
  samples: [
    {
      fields: { context: 'component', mode: 'encode' },
      label: 'Encode query value',
      text: 'hello world & more',
    },
    {
      fields: { context: 'component', mode: 'decode' },
      label: 'Decode query value',
      text: 'hello%20world%20%26%20more',
    },
    {
      fields: { context: 'url', mode: 'encode' },
      label: 'Complete URL',
      text: 'https://example.com/a b?q=čau&next=/home#top',
    },
    { fields: { context: 'form', mode: 'decode' }, label: 'Form plus / space', text: 'a%2Bb+c' },
    { fields: { context: 'form', mode: 'encode' }, label: 'Encode form value', text: 'a+b c' },
    {
      fields: { context: 'component', mode: 'encode' },
      label: 'Redirect URL as value',
      text: 'https://example.com/?a=1&b=2',
    },
    {
      fields: { context: 'url', mode: 'decode' },
      label: 'Decode complete URL',
      text: 'https://example.com/a%20b?q=%C4%8Dau',
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
        { label: 'Encode', value: 'encode' },
        { label: 'Decode', value: 'decode' },
      ],
    },
    {
      id: 'context',
      label: 'URL context',
      type: 'select',
      defaultValue: 'component',
      options: [
        { label: 'Component / query value (%20 spaces)', value: 'component' },
        { label: 'Complete URL (preserve separators)', value: 'url' },
        { label: 'Form value (+ spaces)', value: 'form' },
      ],
      help: 'Component is for one path segment or query value. Form is for one application/x-www-form-urlencoded value, not an entire query string.',
    },
  ],
  keywords: [
    'url',
    'url encode',
    'url decode',
    'url-encode',
    'url-decode',
    'uri',
    'encode',
    'decode',
    'encoder',
    'decoder',
    'percent',
    'encodeURIComponent',
    'decodeURIComponent',
    'query',
    'form',
  ],
  textConversion: { decodedLabel: 'Plain text / URL', encodedLabel: 'Encoded URL text' },
  relatedToolIds: ['url-parse', 'query-string-parser', 'base64-encode'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const mode = conversionMode(fields);
      const context = fields.context || 'component';

      if (context !== 'component' && context !== 'url' && context !== 'form')
        throw new ToolError('Choose Component, Complete URL or Form value.');

      return {
        text: mode === 'decode' ? decodeUrlText(text, context) : encodeUrlText(text, context),
        language: 'plaintext',
        summary: `${mode === 'decode' ? 'Decoded' : 'Encoded'} · ${urlContextLabels[context]} · ${context === 'form' ? '+ means space' : '+ stays literal'}.`,
      };
    }),
};

export const urlDecodeTool: ToolDefinition = {
  ...urlEncodeTool,
  aliasOf: 'url-encode',
  id: 'url-decode',
  name: 'URL Decode',
  fields: urlEncodeTool.fields?.map((field) => ({
    ...field,
    defaultValue: field.id === 'mode' ? 'decode' : 'form',
  })),
  run: (input) =>
    urlEncodeTool.run({ ...input, fields: { mode: 'decode', context: 'form', ...input.fields } }),
};
