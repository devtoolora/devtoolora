import { ToolDefinition, ToolError } from '@devtoolora/core';
import { decodeBase64Text, encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { base64FileMaxBytes, runBase64File } from './base64File';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const base64EncodeTool: ToolDefinition = {
  id: 'base64-encode',
  name: 'Base64 Encode / Decode',
  category: 'Encoders',
  description:
    'Encode text or files as Base64, or decode Base64 to UTF-8 text or a downloadable file.',
  samples: [
    { fields: { alphabet: 'standard', mode: 'encode' }, label: 'Encode greeting', text: 'hello' },
    {
      fields: { alphabet: 'standard', mode: 'decode' },
      label: 'Decode greeting',
      text: 'aGVsbG8=',
    },
    {
      fields: { alphabet: 'standard', mode: 'encode' },
      label: 'Unicode text',
      text: 'Příliš žluťoučký 🐎',
    },
    { fields: { alphabet: 'url-safe', mode: 'decode' }, label: 'URL-safe decode', text: 'SGk_' },
    {
      fields: { alphabet: 'standard', fileName: '', inputType: 'file', mode: 'decode' },
      label: 'Decode PNG file',
      text: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    },
    {
      fields: { alphabet: 'standard', fileName: '', inputType: 'file', mode: 'decode' },
      label: 'Decode PDF header',
      text: 'JVBERi0xLjcKJSBERU1P',
    },
  ],
  badge: { accent: 'signal', glyph: '64' },
  fileModeWhen: { field: 'inputType', is: ['file'] },
  inputKind: 'text',
  inputVisibleWhen: {
    anyOf: [
      { field: 'inputType', isNot: ['file'] },
      { field: 'mode', is: ['decode'] },
    ],
  },
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      id: 'inputType',
      label: 'Content',
      type: 'select',
      presentation: 'segmented',
      defaultValue: 'text',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'File', value: 'file' },
      ],
    },
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
      id: 'alphabet',
      label: 'Alphabet',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Standard Base64 (+ /, padded)', value: 'standard' },
        { label: 'URL-safe Base64 (- _, unpadded)', value: 'url-safe' },
      ],
      help: 'Choose the alphabet used by your source or destination. URL-safe output omits trailing = padding.',
      visibleWhen: {
        anyOf: [
          { field: 'inputType', isNot: ['file'] },
          { field: 'mode', is: ['decode'] },
          { field: 'fileOutput', isNot: ['data-uri'] },
        ],
      },
    },
    {
      id: 'file',
      label: 'Local file',
      required: true,
      type: 'file',
      maxBytes: base64FileMaxBytes,
      help: 'Choose or drop one file, up to 10 MiB. Its raw bytes stay local; run Encode to see the result and supported image preview.',
      visibleWhen: [
        { field: 'inputType', is: ['file'] },
        { field: 'mode', isNot: ['decode'] },
      ],
    },
    {
      id: 'fileOutput',
      label: 'File output',
      type: 'select',
      presentation: 'segmented',
      defaultValue: 'base64',
      options: [
        { label: 'Base64', value: 'base64' },
        { label: 'Data URI', value: 'data-uri' },
      ],
      help: 'Data URI includes the media type and always uses standard Base64; switch back to Base64 for the raw value.',
      visibleWhen: [
        { field: 'inputType', is: ['file'] },
        { field: 'mode', isNot: ['decode'] },
      ],
    },
    {
      id: 'fileName',
      label: 'Download filename',
      type: 'text',
      help: 'Optional. Plain Base64 has no filename; leave blank for a suggested name based on recognized bytes, or decoded.bin.',
      visibleWhen: [
        { field: 'inputType', is: ['file'] },
        { field: 'mode', is: ['decode'] },
      ],
    },
  ],
  keywords: [
    'base64',
    'base64 encode',
    'base64 decode',
    'base64-encode',
    'base64-decode',
    'encode',
    'decode',
    'encoder',
    'decoder',
    'utf-8',
    'unicode',
    'url-safe',
    'base64url',
  ],
  textConversion: { decodedLabel: 'UTF-8 text', encodedLabel: 'Base64 text' },
  relatedToolIds: ['hex-text', 'text-binary', 'url-encode'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const mode = conversionMode(fields);
      const alphabet = fields.alphabet || 'standard';

      if (alphabet !== 'standard' && alphabet !== 'url-safe')
        throw new ToolError('Choose Standard or URL-safe Base64.');

      const inputType = fields.inputType || 'text';

      if (inputType !== 'text' && inputType !== 'file')
        throw new ToolError('Choose Text or File content.');
      if (inputType === 'file') return runBase64File(text, fields, mode, alphabet);

      const output =
        mode === 'decode' ? decodeBase64Text(text, alphabet) : encodeBase64Text(text, alphabet);

      return {
        text: output,
        language: 'plaintext',
        summary: `${mode === 'decode' ? 'Decoded UTF-8 text' : 'Encoded Base64'} · ${alphabet === 'standard' ? 'standard alphabet' : 'URL-safe alphabet'} · ${new TextEncoder().encode(mode === 'decode' ? output : text).length} UTF-8 bytes.`,
      };
    }),
};

export const base64DecodeTool: ToolDefinition = {
  ...base64EncodeTool,
  aliasOf: 'base64-encode',
  id: 'base64-decode',
  name: 'Base64 Decode',
  fields: base64EncodeTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'decode' } : field,
  ),
  run: (input) => base64EncodeTool.run({ ...input, fields: { mode: 'decode', ...input.fields } }),
};
