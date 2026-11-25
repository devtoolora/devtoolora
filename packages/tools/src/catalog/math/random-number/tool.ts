import type { ToolDefinition, ToolField } from '@devtoolora/core';
import { randomDecimals, randomIntegers, rollDice } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, mathOutput } from '../shared';

const modes = ['integers', 'decimals', 'dice'] as const;

type Mode = (typeof modes)[number];

const only = (...is: Mode[]) => ({ field: 'mode', is });
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const fields: ToolField[] = [
  {
    defaultValue: 'integers',
    id: 'mode',
    label: 'Mode',
    options: [
      { label: 'Integers', value: 'integers' },
      { label: 'Decimals', value: 'decimals' },
      { label: 'Dice', value: 'dice' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  {
    defaultValue: '1',
    id: 'min',
    label: 'Min',
    type: 'number',
    visibleWhen: only('integers', 'decimals'),
  },
  {
    defaultValue: '100',
    id: 'max',
    label: 'Max',
    type: 'number',
    visibleWhen: only('integers', 'decimals'),
  },
  {
    defaultValue: '1',
    id: 'count',
    label: 'Count',
    type: 'number',
    visibleWhen: only('integers', 'decimals'),
  },
  {
    defaultValue: '2',
    id: 'places',
    label: 'Decimal places',
    type: 'number',
    visibleWhen: only('decimals'),
  },
  {
    defaultValue: 'false',
    id: 'unique',
    label: 'Unique values',
    type: 'checkbox',
    visibleWhen: only('integers'),
  },
  {
    defaultValue: 'false',
    id: 'sorted',
    label: 'Sort ascending',
    type: 'checkbox',
    visibleWhen: only('integers'),
  },
  {
    defaultValue: '2d6',
    id: 'dice',
    label: 'Dice (NdM+K)',
    type: 'text',
    visibleWhen: only('dice'),
  },
  { defaultValue: '1', id: 'rolls', label: 'Rolls', type: 'number', visibleWhen: only('dice') },
];

function runMode(mode: Mode, f: Record<string, string>) {
  if (mode === 'dice') {
    const notation = (f.dice ?? '2d6').trim();
    const { rolls, text } = rollDice(notation, Number(f.rolls ?? '1'));

    return mathOutput(text, 'dice', `${plural(rolls.length, 'roll')} of ${notation}`, false);
  }

  const count = Number(f.count ?? '1');
  const base = { count, max: f.max ?? '100', min: f.min ?? '1' };

  if (mode === 'decimals') {
    const values = randomDecimals({ ...base, places: Number(f.places ?? '2') });

    return mathOutput(
      `${values.join('\n')}\n`,
      'random-numbers',
      `${plural(count, 'decimal')} from ${base.min} to ${base.max}`,
      false,
    );
  }

  const values = randomIntegers({
    ...base,
    sorted: booleanField(f.sorted, false),
    unique: booleanField(f.unique, false),
  });

  return mathOutput(
    `${values.join('\n')}\n`,
    'random-numbers',
    `${plural(count, 'integer')} from ${base.min} to ${base.max}`,
    false,
  );
}

export const randomNumberTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Math',
  description:
    'Draw random integers or decimals from a range, or roll dice in NdM+K notation, using cryptographically secure randomness.',
  fields,
  freshResults: true,
  id: 'random-number',
  inputKind: 'none',
  keywords: ['random', 'dice', 'roll', 'rng', 'lottery', 'integer', 'decimal', 'crypto'],
  name: 'Random Number Generator',
  outputKind: 'text',
  relatedToolIds: ['shuffle-lines', 'random-port'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: f }) =>
    withToolError(() =>
      runMode(choiceField(f.mode, 'integers', modes, 'Choose integers, decimals or dice.'), f),
    ),
  samples: [
    { fields: { mode: 'integers' }, label: 'Number from 1 to 100' },
    {
      fields: {
        count: '10',
        max: '49',
        min: '1',
        mode: 'integers',
        sorted: 'true',
        unique: 'true',
      },
      label: 'Lottery draw, 10 unique numbers',
    },
    {
      fields: { count: '5', max: '1000', min: '-1000', mode: 'integers' },
      label: 'Five integers, negative range',
    },
    {
      fields: { count: '5', max: '1', min: '0', mode: 'decimals', places: '4' },
      label: 'Probabilities with 4 decimals',
    },
    { fields: { dice: '2d6', mode: 'dice' }, label: 'Roll 2d6' },
    { fields: { dice: '1d20+5', mode: 'dice', rolls: '3' }, label: 'Three d20 rolls with +5' },
  ],
  supportsSelection: false,
};

export const diceRollerTool: ToolDefinition = {
  ...randomNumberTool,
  aliasOf: 'random-number',
  fields: randomNumberTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'dice' } : field,
  ),
  id: 'dice-roller',
  name: 'Dice Roller',
};
