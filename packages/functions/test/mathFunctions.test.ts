import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { calculateFinance, calculatePercentage, evaluateExpression } from '../src/math';

describe('math function boundaries', () => {
  it('parses decimal arithmetic without evaluating code and bounds recursion', () => {
    assert.equal(evaluateExpression('.5 + 1.5'), 2);
    assert.equal(evaluateExpression('1e3 / 4'), 250);
    assert.equal(evaluateExpression('-7 % 3'), -1);
    assert.equal(evaluateExpression('2 + 3 * 4'), 14);
    assert.equal(evaluateExpression('(2 + 3) * 4'), 20);
    assert.equal(evaluateExpression('('.repeat(128) + '1' + ')'.repeat(128)), 1);
    for (const input of [
      '',
      '1/0',
      '2(3)',
      '2 ** 3',
      'Math.random()',
      '1e309',
      '1e308 * 2',
      '1;alert(1)',
      '('.repeat(129) + '1' + ')'.repeat(129),
      '-'.repeat(129) + '1',
      '1'.repeat(10001),
    ])
      assert.throws(() => evaluateExpression(input));
  });

  it('rejects non-finite percentages and ambiguous baselines', () => {
    assert.equal(
      calculatePercentage({ mode: 'percent-change', newValue: 200, oldValue: 250 }).result,
      -20,
    );

    for (const [newValue, direction] of [
      [300, 'increase'],
      [200, 'decrease'],
      [250, 'no change'],
    ] as const) {
      const change = calculatePercentage({ mode: 'percent-change', newValue, oldValue: 250 });

      assert.equal(change.direction, direction);
    }

    assert.equal(calculatePercentage({ mode: 'percent-of', percent: 0, value: 200 }).result, 0);

    assert.throws(
      () => calculatePercentage({ mode: 'percent-change', newValue: 5, oldValue: -10 }),
      /positive old value/,
    );

    assert.throws(() => calculatePercentage({ mode: 'what-percent', part: 5, total: 0 }));
    assert.throws(() => calculatePercentage({ mode: 'percent-of', percent: Infinity, value: 1 }));

    assert.throws(
      () => calculatePercentage({ mode: 'add-percent', percent: 1e308, value: 1e308 }),
      /numeric range/,
    );
  });

  it('checks financial assumptions and uses stable tiny-rate loan arithmetic', () => {
    assert.deepEqual(calculateFinance('compound', 1000, 10, 2), {
      futureValue: 1210,
      interestEarned: 210,
    });

    assert.deepEqual(calculateFinance('loan', 1200, 0, 1), {
      monthlyPayment: 100,
      totalInterest: 0,
      totalPaid: 1200,
    });

    assert.equal(calculateFinance('loan', 1200, 12, 1).monthlyPayment, 106.62);
    assert.equal(calculateFinance('loan', 1200, 1e-14, 1).monthlyPayment, 100);
    assert.equal(calculateFinance('loan', 0, 5, 1.5).monthlyPayment, 0);
    for (const [principal, rate, years] of [
      [-1, 5, 1],
      [1, -1, 1],
      [1, 5, 0],
      [Infinity, 5, 1],
      [1, Infinity, 1],
      [1, 5, 0.1],
    ] as [number, number, number][])
      assert.throws(() => calculateFinance('loan', principal, rate, years));
    assert.throws(() => calculateFinance('compound', 1e308, 100, 1000), /numeric range/);
  });

  it('returns exact decimal percentages without float noise', () => {
    const percentOf = (percent: number, value: number) =>
      calculatePercentage({ mode: 'percent-of', percent, value }).result;
    const change = (oldValue: number, newValue: number) =>
      calculatePercentage({ mode: 'percent-change', newValue, oldValue });

    assert.equal(percentOf(7, 100), 7);
    assert.equal(percentOf(29, 100), 29);
    assert.equal(percentOf(15, 19.99), 2.9985);
    assert.equal(percentOf(-7, 100), -7);
    assert.equal(percentOf(0.07, 1e300), 7e296);
    assert.equal(change(100, 107).result, 7);
    assert.equal(change(1, 1.1).result, 10);
    assert.equal(change(1, 1.1).changeAmount, 0.1);
    assert.equal(change(100.1, 100).changeAmount, -0.1);
    assert.equal(calculatePercentage({ mode: 'what-percent', part: 0.3, total: 0.1 }).result, 300);

    assert.equal(
      calculatePercentage({ mode: 'what-percent', part: 1, total: 3 }).result,
      33.333333333333336,
    );

    assert.deepEqual(calculatePercentage({ mode: 'add-percent', percent: 7, value: 1.1 }).result, {
      decreased: 1.023,
      increased: 1.177,
    });
  });
});
