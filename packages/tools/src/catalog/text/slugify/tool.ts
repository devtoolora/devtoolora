import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { slugify } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { checkbox } from '../shared';

export const slugifyTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Create predictable ASCII or Unicode slugs with safe separators and explicit accent handling.',
  fields: [
    {
      defaultValue: 'ascii',
      help: 'ASCII removes Latin accents automatically. Unicode retains letters and combining marks from other scripts.',
      id: 'alphabet',
      label: 'Characters',
      options: [
        { label: 'ASCII', value: 'ascii' },
        { label: 'Unicode', value: 'unicode' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '-',
      id: 'separator',
      label: 'Separator',
      options: [
        { label: 'Hyphen (-)', value: '-' },
        { label: 'Underscore (_)', value: '_' },
        { label: 'Dot (.)', value: '.' },
      ],
      type: 'select',
    },
    { defaultValue: 'true', id: 'lowercase', label: 'Lowercase', type: 'checkbox' },
    { defaultValue: 'true', id: 'preserveNumbers', label: 'Preserve numbers', type: 'checkbox' },
    {
      defaultValue: 'true',
      help: 'Unicode mode only. Removes marks attached to Latin letters; marks belonging to other scripts remain.',
      id: 'removeAccents',
      label: 'Remove Latin accents',
      type: 'checkbox',
      visibleWhen: { field: 'alphabet', isNot: ['ascii'] },
    },
  ],
  id: 'slugify',
  inputKind: 'text',
  keywords: ['slug', 'url path', 'unicode', 'ascii', 'title', 'diacritics'],
  name: 'Slugify',
  outputKind: 'text',
  relatedToolIds: ['case-convert', 'strip-diacritics', 'url-encode'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const alphabet = fields.alphabet ?? 'ascii';

      if (alphabet !== 'ascii' && alphabet !== 'unicode')
        throw new ToolError('Choose ASCII or Unicode characters.');

      const removeAccents = checkbox(fields, 'removeAccents', 'Remove Latin accents');

      const output = slugify(text, {
        alphabet,
        lowercase: checkbox(fields, 'lowercase', 'Lowercase'),
        preserveNumbers: checkbox(fields, 'preserveNumbers', 'Preserve numbers'),
        removeAccents,
        separator: fields.separator ?? '-',
      });

      if (!output)
        throw new ToolError(
          `No supported letters or numbers remain. ${alphabet === 'ascii' ? 'Choose Unicode for non-Latin text, or change the input.' : 'Add a name or title instead of punctuation or emoji only.'}`,
        );

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: 'slug.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: `${alphabet === 'ascii' ? 'ASCII' : 'Unicode'} slug · ${[...output].length} code points · ${new TextEncoder().encode(output).length} UTF-8 bytes · uniqueness not checked.`,
        text: output,
      };
    }),
  samples: [
    {
      fields: {
        alphabet: 'ascii',
        lowercase: 'true',
        preserveNumbers: 'true',
        removeAccents: 'true',
        separator: '-',
      },
      label: 'Blog post title',
      text: 'How to Build Ultra-Fast Local Tools in 2026!',
    },
    {
      fields: {
        alphabet: 'ascii',
        lowercase: 'true',
        preserveNumbers: 'true',
        removeAccents: 'true',
        separator: '-',
      },
      label: 'French with accents',
      text: 'Crème brûlée à la vanille #42',
    },
    {
      fields: {
        alphabet: 'ascii',
        lowercase: 'true',
        preserveNumbers: 'true',
        removeAccents: 'true',
        separator: '-',
      },
      label: 'Latin letters beyond accent marks',
      text: 'Straße Æsir Łódź Øresund Œuvre',
    },
    {
      fields: {
        alphabet: 'unicode',
        lowercase: 'true',
        preserveNumbers: 'true',
        removeAccents: 'false',
        separator: '-',
      },
      label: 'Keep Czech accents',
      text: 'Příliš žluťoučký kůň 42',
    },
    {
      fields: {
        alphabet: 'unicode',
        lowercase: 'true',
        preserveNumbers: 'true',
        removeAccents: 'false',
        separator: '-',
      },
      label: 'Keep non-Latin scripts',
      text: '你好 世界 नमस्ते दुनिया',
    },
    {
      fields: {
        alphabet: 'ascii',
        lowercase: 'false',
        preserveNumbers: 'false',
        removeAccents: 'true',
        separator: '_',
      },
      label: 'Case-preserving underscore name',
      text: 'Release 2026 / Build 42 — Alpha',
    },
  ],
  supportsSelection: true,
};
