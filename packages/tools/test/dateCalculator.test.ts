import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { dateCalculatorTool } from '../src/catalog/dateTime';
import { contentOf } from './toolContent';

describe('date calculator tool', () => {
  it('summarizes the difference', async () => {
    const result = await dateCalculatorTool.run({
      fields: { end: '2024-03-01', mode: 'difference' },
      text: '2024-01-01',
    });

    assert.equal(result.summary, '60 days');

    assert.equal(
      (
        await dateCalculatorTool.run({
          fields: { end: '2024-01-02', mode: 'difference' },
          text: '2024-01-01',
        })
      ).summary,
      '1 day',
    );

    assert.ok(contentOf(dateCalculatorTool).faq?.length);
  });

  it('reports invalid dates', async () => {
    await assert.rejects(
      async () => dateCalculatorTool.run({ fields: { mode: 'info' }, text: '2026-02-30' }),
      {
        message: /2026-02-30 is not a valid calendar date\./,
      },
    );
  });
});
