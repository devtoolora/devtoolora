import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { statisticsCalculatorTool } from '../src/catalog/math';
import { contentOf } from './toolContent';

const run = (text: string, fields: Record<string, string> = {}) =>
  statisticsCalculatorTool.run({ fields, text });

describe('Statistics calculator tool', () => {
  it('declares its metadata', () => {
    assert.equal(statisticsCalculatorTool.id, 'statistics-calculator');
    assert.equal(statisticsCalculatorTool.name, 'Statistics Calculator');
    assert.equal(statisticsCalculatorTool.category, 'Math');
    assert.equal(statisticsCalculatorTool.inputKind, 'text');
    assert.equal(statisticsCalculatorTool.outputKind, 'text');

    assert.deepEqual(
      statisticsCalculatorTool.fields?.map((field) => [field.id, field.label, field.defaultValue]),
      [
        ['percentile', 'Custom percentile', undefined],
        ['output', 'Output', 'table'],
      ],
    );

    assert.deepEqual(statisticsCalculatorTool.relatedToolIds, [
      'math-evaluator',
      'percentage-calculator',
    ]);

    assert.equal(contentOf(statisticsCalculatorTool).faq?.length, 4);
    assert.ok((statisticsCalculatorTool.samples?.length ?? 0) >= 6);
  });

  it('prints a table', async () => {
    const result = await run('2, 4; 4 4\n5 5 7 9');

    assert.match(result.text, /^Mean +5$/m);
    assert.equal(result.summary, '8 numbers · mean 5');
    assert.equal(result.artifact?.fileName, 'statistics.txt');
    assert.equal((await run('42')).summary, '1 number · mean 42');
  });

  it('prints JSON', async () => {
    const result = await run('2 4 4 4 5 5 7 9', { output: 'json' });
    const json = JSON.parse(result.text) as Record<string, unknown>;

    assert.ok(result.text.endsWith('\n'));
    assert.equal(json.mean, 5);
    assert.equal(json.sampleStdDev, 2.1380899352994);
    assert.deepEqual(json.mode, [4]);
    assert.equal(result.artifact?.fileName, 'statistics.json');
  });

  it('adds a custom percentile', async () => {
    assert.match((await run('1 2 3 4', { percentile: '10' })).text, /^P10 +1\.3$/m);
  });

  it('rejects invalid input', async () => {
    await assert.rejects(async () => run('1 x'), { message: /"x" at position 2/ });

    await assert.rejects(async () => run('1 2', { percentile: '101' }), {
      message: 'Custom percentile must be a number from 0 to 100.',
    });
  });

  it('runs every sample', async () => {
    for (const sample of statisticsCalculatorTool.samples ?? []) {
      const result = await run(sample.text ?? '', sample.fields ?? {});

      assert.match(result.summary ?? '', /mean/, sample.label);
    }
  });
});
