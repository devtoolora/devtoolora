import { ToolDefinition } from '@devtoolora/core';
import { decodeNato, spellNato } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, conversionMode } from '../shared';

export const natoPhoneticTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description: 'Spell text with the NATO phonetic alphabet or turn code words back into text.',
  fields: [
    {
      defaultValue: 'encode',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Text \u2192 NATO', value: 'encode' },
        { label: 'NATO \u2192 text', value: 'decode' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'nato-phonetic',
  inputKind: 'text',
  keywords: ['nato', 'phonetic', 'alphabet', 'spelling', 'alfa', 'bravo', 'charlie', 'radio'],
  name: 'NATO Phonetic Alphabet',
  outputKind: 'text',
  relatedToolIds: ['morse-code', 'classic-ciphers'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = conversionMode(fields);
      const output = mode === 'decode' ? decodeNato(text) : spellNato(text);
      const count = Array.from(mode === 'decode' ? output : text).length;

      return {
        language: 'plaintext',
        summary: `${mode} \u00B7 ${count} ${count === 1 ? 'character' : 'characters'}`,
        text: output,
      };
    }),
  samples: [
    { fields: { mode: 'encode' }, label: 'Spell a call sign', text: 'SOS 2' },
    { fields: { mode: 'encode' }, label: 'Spell a word', text: 'Hello World' },
    { fields: { mode: 'encode' }, label: 'Accents are stripped', text: 'Caf\u00E9 No. 7' },
    { fields: { mode: 'encode' }, label: 'Several lines', text: 'Ab\nCd' },
    {
      fields: { mode: 'decode' },
      label: 'Decode code words',
      text: 'Alfa Juliett X-ray Niner / Two',
    },
    { fields: { mode: 'decode' }, label: 'Decode spoken variants', text: 'alpha juliet xray nine' },
  ],
  supportsSelection: true,
};
