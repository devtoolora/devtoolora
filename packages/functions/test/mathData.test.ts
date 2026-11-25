import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { convertTemperature } from '@devtoolora/functions/measurement';
import {
  convertBase,
  calculateFinance,
  calculatePercentage,
  evaluateExpression,
} from '@devtoolora/functions/math';
import { formatPhone, generateSeededUsers, validateIban } from '@devtoolora/functions/data';

describe('math, measurement, and data functions', () => {
  it('evaluates arithmetic, bases, percentages, and finance', () => {
    assert.equal(evaluateExpression('(12 + 8) * 3 / 4'), 15);
    assert.equal(convertBase('ff', 16, 10).output, '255');
    assert.equal(calculatePercentage({ mode: 'percent-of', percent: 25, value: 200 }).result, 50);

    assert.deepEqual(calculateFinance('compound', 1000, 10, 1), {
      futureValue: 1100,
      interestEarned: 100,
    });
  });

  it('converts temperatures and general units', () => {
    assert.equal(convertTemperature(32, 'f').celsius, 0);
  });

  it('validates and generates deterministic typed data', async () => {
    assert.equal(validateIban('GB82 WEST 1234 5698 7654 32').valid, true);
    assert.equal((await formatPhone('(415) 555-0134', '1')).e164, '+14155550134');
    assert.deepEqual(generateSeededUsers(42, 2), generateSeededUsers(42, 2));
  });
});
