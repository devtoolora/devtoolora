import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  financialCalculatorTool,
  mathEvaluatorTool,
  percentageCalculatorTool,
} from '../src/catalog/math';
import { contentOf } from './toolContent';

describe('math tools', () => {
  it('provides concept/use guides, complete samples and exact downloadable results', async () => {
    for (const tool of [mathEvaluatorTool, percentageCalculatorTool, financialCalculatorTool]) {
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.match(contentOf(tool).documentation?.[0]?.title ?? '', /^What /);
      assert.match(contentOf(tool).documentation?.[1]?.title ?? '', /^When /);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6);
      assert.ok((tool.samples?.length ?? 0) >= 6);

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        assert.ok(result.summary);
        if (tool.id !== 'math-evaluator') assert.doesNotMatch(result.text, /null/);
      }
    }
  });

  it('does not coerce blank, hexadecimal or invalid modes to a plausible answer', async () => {
    for (const value of ['', ' ', '0x10', '1,5', 'Infinity', 'NaN', '1e309']) {
      await assert.rejects(async () =>
        percentageCalculatorTool.run({
          fields: { mode: 'percent-of', percent: value, value: '200' },
          text: '',
        }),
      );

      await assert.rejects(async () =>
        financialCalculatorTool.run({
          fields: { mode: 'loan', principal: value, rate: '5', years: '1' },
          text: '',
        }),
      );
    }

    await assert.rejects(async () =>
      financialCalculatorTool.run({
        fields: { mode: 'wrong', principal: '100', rate: '5', years: '1' },
        text: '',
      }),
    );

    const result = await financialCalculatorTool.run({
      fields: { mode: 'loan', principal: '1200', rate: '0', years: '1' },
      text: '',
    });

    assert.equal(JSON.parse(result.text).monthlyPayment, 100);

    assert.equal(
      JSON.parse(result.text).assumptions.compounding,
      'monthly payments; nominal annual rate / 12',
    );
  });
});
