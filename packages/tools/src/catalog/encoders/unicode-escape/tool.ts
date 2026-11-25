import { ToolDefinition } from '@devtoolora/core';
import { decodeUnicodeEscapes, encodeUnicodeEscapes } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const unicodeEscapeTool: ToolDefinition = {
  id: 'unicode-escape',
  name: 'Unicode Escape',
  category: 'Encoders',
  description:
    'Encode text as JavaScript-style Unicode code point escapes or decode braced and four-digit Unicode escapes.',
  samples: [
    { fields: { mode: 'encode' }, label: 'Symbols', text: 'Hi ✓' },
    {
      fields: { mode: 'decode' },
      label: 'Decode code points',
      text: '\\u{48}\\u{69}\\u{20}\\u{2713}',
    },
    { fields: { mode: 'decode' }, label: 'Decode surrogate pair', text: '\\uD83D\\uDE0A' },
    { fields: { mode: 'decode' }, label: 'Four-digit escapes', text: '\\u0048\\u0069' },
    { fields: { mode: 'decode' }, label: 'Text with escapes', text: 'Caf\\u00e9 \\u{1f600}' },
    { fields: { mode: 'encode' }, label: 'Invisible characters', text: 'a b​c' },
    { fields: { mode: 'encode' }, label: 'Emoji', text: '😊' },
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
  ],
  keywords: [
    'unicode',
    'escape',
    'unescape',
    'code point',
    'utf-16',
    'javascript',
    'surrogate',
    'encode',
    'decode',
  ],
  relatedToolIds: ['hex-text', 'text-binary', 'html-entities'],
  textConversion: { decodedLabel: 'Unicode text', encodedLabel: 'Unicode escape sequences' },
  run: ({ text, fields }) =>
    withToolError(() => ({
      text:
        conversionMode(fields) === 'decode'
          ? decodeUnicodeEscapes(text)
          : encodeUnicodeEscapes(text),
      language: 'plaintext',
      summary: 'Unicode escape conversion complete · code points / UTF-16 units.',
    })),
};
