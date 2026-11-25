import { ToolDefinition } from '@devtoolora/core';
import { decodeHtmlEntities, encodeHtmlEntities } from '@devtoolora/functions/encoding';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const htmlEntitiesTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Escape HTML syntax characters or decode named, decimal and hexadecimal character references as plain text.',
  samples: [
    { fields: { mode: 'encode' }, label: 'HTML snippet', text: '<span title="A&B">Hello</span>' },
    {
      fields: { mode: 'decode' },
      label: 'Decode basic entities',
      text: '&lt;b&gt;A&amp;B&lt;/b&gt;',
    },
    {
      fields: { mode: 'decode' },
      label: 'Named symbols',
      text: 'Price: 10 &euro;\n&copy; 2026 &mdash; A&nbsp;B',
    },
    { fields: { mode: 'decode' }, label: 'Numeric Unicode', text: '&#269; &#x2713; &#128014;' },
    { fields: { mode: 'decode' }, label: 'One escaping layer', text: '&amp;lt;' },
    {
      fields: { mode: 'encode' },
      label: 'Code example',
      text: "if (a < b && b > c) { return 'ok'; }",
    },
    {
      fields: { mode: 'decode' },
      label: 'Missing semicolons',
      text: '&copy 2026 &amp; &notanentity;',
    },
  ],
  fields: [
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
  id: 'html-entities',
  inputKind: 'text',
  keywords: [
    'html',
    'entities',
    'escape',
    'unescape',
    'encode',
    'decode',
    'ampersand',
    'markup',
    'numeric',
    'character references',
  ],
  name: 'HTML Entities',
  outputKind: 'text',
  relatedToolIds: ['unicode-escape', 'url-encode'],
  run: ({ fields, text }) => ({
    language: 'plaintext',
    summary: 'HTML character references processed · one pass · plain-text output.',
    text: conversionMode(fields) === 'decode' ? decodeHtmlEntities(text) : encodeHtmlEntities(text),
  }),
  supportsSelection: true,
  freshResults: true,
  textConversion: { decodedLabel: 'Plain text / HTML source', encodedLabel: 'Escaped HTML text' },
};
