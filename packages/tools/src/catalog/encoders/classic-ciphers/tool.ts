import { ToolDefinition, ToolError } from '@devtoolora/core';
import { applyClassicCipher, type ClassicCipher } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, conversionMode } from '../shared';

const ciphers: readonly ClassicCipher[] = ['vigenere', 'atbash', 'affine', 'rail-fence', 'rot47'];
const cipherLabels: Record<ClassicCipher, string> = {
  affine: 'Affine',
  atbash: 'Atbash',
  'rail-fence': 'Rail fence',
  rot47: 'ROT47',
  vigenere: 'Vigenère',
};

function numberField(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) throw new ToolError(`${name} must be a whole number.`);

  return parsed;
}

// a and b only count modulo 26, so a digit string above 2^53 is reduced before it can round.
function affineField(value: string | undefined, fallback: number, name: string): number {
  const parsed = numberField(value, fallback, name);
  const text = value?.trim() ?? '';

  return !Number.isSafeInteger(parsed) && /^[+-]?\d+$/.test(text)
    ? Number(BigInt(text) % 26n)
    : parsed;
}

export const classicCiphersTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Encode or decode text with Vigenère, Atbash, Affine, Rail fence or ROT47 classic ciphers.',
  fields: [
    {
      defaultValue: 'vigenere',
      id: 'cipher',
      label: 'Cipher',
      options: ciphers.map((value) => ({ label: cipherLabels[value], value })),
      type: 'select',
    },
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
      visibleWhen: { field: 'cipher', is: ['vigenere', 'affine', 'rail-fence'] },
    },
    {
      defaultValue: 'LEMON',
      id: 'key',
      label: 'Key',
      type: 'text',
      visibleWhen: { field: 'cipher', is: ['vigenere'] },
    },
    {
      defaultValue: '5',
      id: 'a',
      label: 'a',
      type: 'number',
      visibleWhen: { field: 'cipher', is: ['affine'] },
    },
    {
      defaultValue: '8',
      id: 'b',
      label: 'b',
      type: 'number',
      visibleWhen: { field: 'cipher', is: ['affine'] },
    },
    {
      defaultValue: '3',
      id: 'rails',
      label: 'Rails',
      type: 'number',
      visibleWhen: { field: 'cipher', is: ['rail-fence'] },
    },
  ],
  freshResults: true,
  id: 'classic-ciphers',
  inputKind: 'text',
  keywords: [
    'cipher',
    'vigenere',
    'atbash',
    'affine',
    'rail fence',
    'rot47',
    'classic',
    'encrypt',
    'decrypt',
  ],
  name: 'Classic Ciphers',
  outputKind: 'text',
  relatedToolIds: ['caesar-cipher', 'morse-code', 'nato-phonetic'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const cipher = choiceField(
        fields.cipher,
        'vigenere',
        ciphers,
        'Choose Vigenère, Atbash, Affine, Rail fence or ROT47.',
      );
      const mode = conversionMode(fields);
      const output = applyClassicCipher(text, {
        a: cipher === 'affine' ? affineField(fields.a, 5, 'a') : 5,
        b: cipher === 'affine' ? affineField(fields.b, 8, 'b') : 8,
        cipher,
        decode: mode === 'decode',
        key: fields.key ?? 'LEMON',
        rails: cipher === 'rail-fence' ? numberField(fields.rails, 3, 'Rails') : 3,
      });

      return {
        language: 'plaintext',
        summary: `${mode} \u00B7 ${cipherLabels[cipher]}`,
        text: output,
      };
    }),
  samples: [
    {
      fields: { cipher: 'vigenere', key: 'LEMON', mode: 'encode' },
      label: 'Vigenère with LEMON',
      text: 'Attack at dawn!',
    },
    {
      fields: { cipher: 'vigenere', key: 'LEMON', mode: 'decode' },
      label: 'Decode Vigenère',
      text: 'Lxfopv ef rnhr!',
    },
    { fields: { cipher: 'atbash' }, label: 'Atbash mirror', text: 'Hello' },
    {
      fields: { a: '5', b: '8', cipher: 'affine', mode: 'encode' },
      label: 'Affine 5x + 8',
      text: 'AFFINE CIPHER',
    },
    {
      fields: { cipher: 'rail-fence', mode: 'encode', rails: '3' },
      label: 'Rail fence, 3 rails',
      text: 'WEAREDISCOVEREDFLEEATONCE',
    },
    { fields: { cipher: 'rot47' }, label: 'ROT47 symbols', text: 'Hello, World!' },
  ],
  supportsSelection: true,
};

export const vigenereCipherTool: ToolDefinition = {
  ...classicCiphersTool,
  aliasOf: 'classic-ciphers',
  id: 'vigenere-cipher',
  name: 'Vigenère Cipher',
  run: (input) =>
    classicCiphersTool.run({ ...input, fields: { cipher: 'vigenere', ...input.fields } }),
};
