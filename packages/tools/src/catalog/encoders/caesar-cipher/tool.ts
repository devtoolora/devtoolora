import { ToolDefinition, ToolError } from '@devtoolora/core';
import { caesarCipher } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const caesarCipherTool: ToolDefinition = {
  id: 'caesar-cipher',
  name: 'Caesar/ROT13 Cipher',
  category: 'Encoders',
  description:
    'Rotate ASCII letters by a whole-number shift, preserving case and other characters; defaults to ROT13.',
  samples: [
    { fields: { shift: '13' }, label: 'ROT13', text: 'Hello' },
    { fields: { shift: '3' }, label: 'Shift forward by 3', text: 'Abc xyz!' },
    { fields: { shift: '-3' }, label: 'Shift backward by 3', text: 'Def abc!' },
    { fields: { shift: '13' }, label: 'Decode ROT13 sentence', text: 'Uryyb, jbeyq!' },
    { fields: { shift: '3' }, label: 'Classic Caesar shift', text: 'VENI VIDI VICI' },
    { fields: { shift: '29' }, label: 'Shift wraps past 26', text: 'Abc' },
    { fields: { shift: '13' }, label: 'Digits and accents unchanged', text: 'Room 101, café!' },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  fields: [
    {
      id: 'shift',
      label: 'Shift',
      type: 'number',
      defaultValue: '13',
      help: 'Required whole-number rotation; positive moves forward, negative moves backward, and 0 leaves the text unchanged.',
    },
  ],
  keywords: ['caesar', 'rot13', 'rotation', 'shift', 'cipher', 'obfuscation', 'letters'],
  relatedToolIds: ['morse-code', 'ascii-text'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const shift = caesarShift(fields.shift);

      return {
        text: caesarCipher(text, shift),
        language: 'plaintext',
        summary: `ASCII letter rotation complete · shift ${shift}.`,
      };
    }),
};

function caesarShift(value: string | undefined): number {
  if (value === undefined) return 13;

  const input = value.trim();

  if (!input) throw new ToolError('Enter a whole-number Shift, such as 13 for ROT13, 3 or -3.');
  if (!/^[+-]?\d+$/.test(input) || !Number.isSafeInteger(Number(input)))
    throw new ToolError(
      'Shift must be a whole number in the JavaScript safe-integer range, such as 13, 3 or -3.',
    );

  return Number(input);
}
