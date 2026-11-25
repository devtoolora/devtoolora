import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { bandwidthCalculatorTool } from '../src/catalog/network';
import { contentOf } from './toolContent';

const defaults = {
  overhead: '0',
  rate: '100',
  rateUnit: 'Mbit/s',
  size: '1',
  sizeUnit: 'GB',
  solveFor: 'time',
  time: '60',
  timeUnit: 's',
};
const run = (fields: Record<string, string> = {}) =>
  bandwidthCalculatorTool.run({ fields: { ...defaults, ...fields }, text: '' });

describe('bandwidth calculator tool', () => {
  it('declares its fields', () => {
    assert.equal(bandwidthCalculatorTool.id, 'bandwidth-calculator');
    assert.equal(bandwidthCalculatorTool.name, 'Bandwidth & Transfer Time Calculator');
    assert.equal(bandwidthCalculatorTool.category, 'Network');
    assert.equal(bandwidthCalculatorTool.inputKind, 'none');
    assert.equal(bandwidthCalculatorTool.autoRun, true);

    assert.deepEqual(
      bandwidthCalculatorTool.fields?.map(({ defaultValue, id, label }) => [
        id,
        label,
        defaultValue,
      ]),
      [
        ['solveFor', 'Solve for', 'time'],
        ['size', 'Size', '1'],
        ['sizeUnit', 'Size unit', 'GB'],
        ['rate', 'Rate', '100'],
        ['rateUnit', 'Rate unit', 'Mbit/s'],
        ['time', 'Time', '60'],
        ['timeUnit', 'Time unit', 's'],
        ['overhead', 'Protocol overhead (%)', '0'],
      ],
    );

    assert.deepEqual(bandwidthCalculatorTool.relatedToolIds, [
      'unit-converter',
      'duration-converter',
    ]);

    assert.equal(contentOf(bandwidthCalculatorTool).faq?.length, 4);
    assert.equal(bandwidthCalculatorTool.samples?.length, 6);
  });

  it('solves for time, size and rate', async () => {
    const time = await run();

    assert.match(time.text, /^Time +1 min 20 s$/m);
    assert.equal(time.summary, '1 GB at 100 Mbit/s → 1 min 20 s');
    assert.match((await run({ overhead: '10' })).text, /^Time +1 min 28 s 889 ms$/m);

    assert.equal(
      (await run({ solveFor: 'size', time: '80' })).summary,
      '100 Mbit/s for 80 s → 1 GB',
    );

    assert.match(
      (await run({ rateUnit: 'MB/s', sizeUnit: 'GiB', solveFor: 'rate', time: '60' })).text,
      /^MB\/s +17\.89/m,
    );
  });

  it('reports errors', async () => {
    await assert.rejects(async () => run({ overhead: '100' }), {
      message: 'Overhead must be within 0-99 %.',
    });

    await assert.rejects(async () => run({ rate: '0' }), { message: 'Rate must be above zero.' });
  });
});
