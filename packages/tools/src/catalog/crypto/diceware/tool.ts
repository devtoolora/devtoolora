import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  dicewareFromRolls,
  generateDiceware,
  type DicewareOptions,
} from '@devtoolora/functions/crypto';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, countLabel, cryptoTextResult } from '../shared';

const separators = ['space', 'dash', 'underscore', 'none'] as const;
const defaults = {
  capitalize: 'false',
  count: '1',
  digit: 'false',
  separator: 'space',
  words: '6',
};

export const dicewareTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Generate Diceware passphrases from the EFF long word list with the browser random generator, or turn your own physical dice rolls into words. Shows the entropy in bits.',
  fields: [
    { defaultValue: '6', id: 'words', label: 'Words', type: 'number' },
    { defaultValue: '1', id: 'count', label: 'Count', type: 'number' },
    {
      defaultValue: 'space',
      id: 'separator',
      label: 'Separator',
      options: [
        { label: 'Space', value: 'space' },
        { label: 'Dash', value: 'dash' },
        { label: 'Underscore', value: 'underscore' },
        { label: 'None', value: 'none' },
      ],
      type: 'select',
    },
    { defaultValue: 'false', id: 'capitalize', label: 'Capitalize words', type: 'checkbox' },
    { defaultValue: 'false', id: 'digit', label: 'Add a digit', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'diceware',
  inputKind: 'optionalText',
  inputPresentation: { label: 'Dice rolls (optional, five digits per word)' },
  keywords: ['diceware', 'passphrase', 'eff', 'wordlist', 'dice', 'password', 'random words'],
  name: 'Diceware Passphrase Generator',
  outputKind: 'text',
  relatedToolIds: ['password-generator', 'password-strength', 'bip39'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => runDiceware(fields, text)),
  samples: [
    { fields: defaults, label: 'Six words' },
    {
      fields: { ...defaults, capitalize: 'true', separator: 'dash', words: '5' },
      label: 'Five words dashed and capitalized',
    },
    {
      fields: defaults,
      label: 'From dice rolls',
      text: '11111\n22222\n33333\n44444\n55555',
    },
    {
      fields: { ...defaults, separator: 'underscore', words: '8' },
      label: 'Eight words underscored',
    },
    { fields: { ...defaults, digit: 'true', words: '4' }, label: 'Four words with a digit' },
    {
      fields: { ...defaults, count: '3', words: '7' },
      label: 'Three passphrases of seven words',
    },
  ],
  sensitiveInput: true,
  supportsSelection: false,
};

function runDiceware(fields: Record<string, string>, text: string): ToolResult {
  const separator = separators.find((item) => item === (fields.separator || 'space'));

  if (!separator) throw new ToolError('Choose space, dash, underscore or no separator.');

  const format = {
    capitalize: fields.capitalize === 'true',
    digit: fields.digit === 'true',
    separator,
  };
  const rolls = text.trim();
  const { bits, passphrases } = rolls
    ? dicewareFromRolls(rolls, format)
    : generateDiceware({
        ...format,
        count: integer(fields.count, 1),
        words: integer(fields.words, 6),
      } satisfies DicewareOptions);
  const wordCount = rolls ? rolls.split(/\s+/).length : integer(fields.words, 6);
  const tail = rolls ? 'from dice rolls' : countLabel(passphrases.length, 'passphrase');

  return cryptoTextResult(
    'diceware',
    passphrases.join('\n'),
    `${countLabel(wordCount, 'word')} · ${bits.toFixed(1)} bits · ${tail}`,
  );
}

function integer(value: string | undefined, fallback: number): number {
  return value?.trim() ? Number(value) : fallback;
}
