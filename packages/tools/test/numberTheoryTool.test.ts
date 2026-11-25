import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { numberTheoryTool } from '../src/catalog/math';
import { contentOf } from './toolContent';

const run = (text: string, fields: Record<string, string> = {}) =>
  numberTheoryTool.run({ fields, text });

describe('Number theory tool', () => {
  it('declares its metadata', () => {
    assert.equal(numberTheoryTool.id, 'number-theory');
    assert.equal(numberTheoryTool.name, 'Number Theory Calculator');
    assert.equal(numberTheoryTool.category, 'Math');
    assert.equal(numberTheoryTool.inputKind, 'text');
    assert.equal(numberTheoryTool.outputKind, 'text');

    assert.deepEqual(
      numberTheoryTool.fields?.map((field) => [field.id, field.label, field.defaultValue]),
      [['mode', 'Mode', 'factorize']],
    );

    const [mode] = numberTheoryTool.fields ?? [];

    assert.deepEqual(mode?.type === 'select' ? mode.options.map((option) => option.label) : [], [
      'Factorize',
      'Primality',
      'GCD & LCM',
    ]);

    assert.deepEqual(numberTheoryTool.relatedToolIds, ['math-evaluator', 'base-converter']);
    assert.equal(contentOf(numberTheoryTool).faq?.length, 4);
    assert.ok((numberTheoryTool.samples?.length ?? 0) >= 6);
  });

  it('factorizes by default', async () => {
    const result = await run('360');

    assert.match(result.text, /^Divisors +24$/m);
    assert.equal(result.summary, '2^3 × 3^2 × 5');
    assert.equal(result.artifact?.fileName, 'factorization.txt');
  });

  it('tests primality', async () => {
    assert.equal((await run('97', { mode: 'primality' })).summary, 'prime');
    assert.equal((await run('561', { mode: 'primality' })).summary, 'composite');

    for (const input of ['0', '1', '-7'])
      assert.equal((await run(input, { mode: 'primality' })).summary, 'not prime');

    assert.equal(
      (await run(String(2n ** 127n - 1n), { mode: 'primality' })).summary,
      'probable prime',
    );
  });

  it('finds the GCD and LCM', async () => {
    const result = await run('84, 126, 210', { mode: 'gcd' });

    assert.match(result.text, /^LCM +1260$/m);
    assert.equal(result.summary, 'GCD 42 · LCM 1260');
  });

  it('rejects invalid input', async () => {
    await assert.rejects(async () => run('1'), { message: /from 2/ });
    await assert.rejects(async () => run('1', { mode: 'other' }), { message: /Choose/ });
  });

  it('runs every sample', async () => {
    for (const sample of numberTheoryTool.samples ?? []) {
      const result = await run(sample.text ?? '', sample.fields ?? {});

      assert.ok(result.summary, sample.label);
    }
  });
});
