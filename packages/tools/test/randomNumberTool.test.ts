import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { diceRollerTool, randomNumberTool } from '../src/catalog/math';
import { contentOf } from './toolContent';

const defaults = {
  count: '1',
  dice: '2d6',
  max: '100',
  min: '1',
  mode: 'integers',
  places: '2',
  rolls: '1',
  sorted: 'false',
  unique: 'false',
};
const run = (fields: Record<string, string> = {}) =>
  randomNumberTool.run({ fields: { ...defaults, ...fields }, text: '' });

describe('random number tool', () => {
  it('declares its fields', () => {
    assert.equal(randomNumberTool.id, 'random-number');
    assert.equal(randomNumberTool.name, 'Random Number Generator');
    assert.equal(randomNumberTool.category, 'Math');
    assert.equal(randomNumberTool.inputKind, 'none');
    assert.equal(randomNumberTool.autoRun, undefined);

    assert.deepEqual(
      randomNumberTool.fields?.map(({ defaultValue, id, label, visibleWhen }) => [
        id,
        label,
        defaultValue,
        visibleWhen,
      ]),
      [
        ['mode', 'Mode', 'integers', undefined],
        ['min', 'Min', '1', { field: 'mode', is: ['integers', 'decimals'] }],
        ['max', 'Max', '100', { field: 'mode', is: ['integers', 'decimals'] }],
        ['count', 'Count', '1', { field: 'mode', is: ['integers', 'decimals'] }],
        ['places', 'Decimal places', '2', { field: 'mode', is: ['decimals'] }],
        ['unique', 'Unique values', 'false', { field: 'mode', is: ['integers'] }],
        ['sorted', 'Sort ascending', 'false', { field: 'mode', is: ['integers'] }],
        ['dice', 'Dice (NdM+K)', '2d6', { field: 'mode', is: ['dice'] }],
        ['rolls', 'Rolls', '1', { field: 'mode', is: ['dice'] }],
      ],
    );

    assert.deepEqual(randomNumberTool.relatedToolIds, ['shuffle-lines', 'random-port']);
    assert.equal(contentOf(randomNumberTool).faq?.length, 4);
    assert.ok((randomNumberTool.samples?.length ?? 0) >= 6);
    assert.equal(randomNumberTool.freshResults, true);
  });

  it('runs every mode', async () => {
    const integers = await run({ count: '5', max: '9', min: '0', unique: 'true' });

    assert.match(integers.text, /^\d(\n\d){4}\n$/);
    assert.equal(integers.summary, '5 integers from 0 to 9');
    assert.equal((await run()).summary, '1 integer from 1 to 100');

    const decimals = await run({ count: '3', max: '1', min: '0', mode: 'decimals', places: '3' });

    assert.match(decimals.text, /^(\d\.\d{3}\n){3}$/);
    assert.equal(decimals.summary, '3 decimals from 0 to 1');

    const dice = await run({ dice: '2d6+3', mode: 'dice', rolls: '2' });

    assert.match(dice.text, /^(2d6\+3: \[\d, \d\] \+ 3 = \d+\n){2}$/);
    assert.equal(dice.summary, '2 rolls of 2d6+3');
    assert.equal((await run({ mode: 'dice' })).summary, '1 roll of 2d6');
  });

  it('reports errors', async () => {
    await assert.rejects(async () => run({ max: '1', min: '5' }), {
      message: 'Min must not exceed max.',
    });
  });

  it('pins the mode on every sample of both tools', async () => {
    for (const tool of [randomNumberTool, diceRollerTool]) {
      for (const sample of tool.samples ?? []) assert.ok(sample.fields?.mode, sample.label);
    }

    const first = diceRollerTool.samples?.[0];
    const result = await diceRollerTool.run({
      fields: { ...defaults, ...first?.fields, mode: first?.fields?.mode ?? 'dice' },
      text: '',
    });

    assert.match(result.text, /^\d+\n$/);
  });

  it('exposes the dice roller alias', () => {
    const defaultOf = (tool: typeof randomNumberTool) =>
      tool.fields?.find((field) => field.id === 'mode')?.defaultValue;

    assert.equal(diceRollerTool.id, 'dice-roller');
    assert.equal(diceRollerTool.name, 'Dice Roller');
    assert.equal(diceRollerTool.aliasOf, 'random-number');
    assert.equal(defaultOf(diceRollerTool), 'dice');
    assert.equal(defaultOf(randomNumberTool), 'integers');
  });
});
