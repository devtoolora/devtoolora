import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatDouble } from '@devtoolora/functions/math';
import { calculateTransfer } from '@devtoolora/functions/network';

describe('bandwidth calculator', () => {
  it('solves for time', () => {
    const base = {
      overheadPercent: 0,
      rate: 100,
      rateUnit: 'Mbit/s',
      size: 1,
      sizeUnit: 'GB',
      solveFor: 'time',
      timeUnit: 's',
    } as const;
    const t = calculateTransfer(base);

    assert.equal(t.value, 80);
    assert.match(t.text, /^Time +1 min 20 s$/m);
    assert.match(t.text, /^Seconds +80$/m);

    const o = calculateTransfer({ ...base, overheadPercent: 10 });

    assert.match(o.text, /^Time +1 min 28 s 889 ms$/m);
    assert.match(o.text, /^Effective rate +90 Mbit\/s$/m);
  });

  it('solves for size and rate', () => {
    const size = calculateTransfer({
      overheadPercent: 0,
      rate: 100,
      rateUnit: 'Mbit/s',
      sizeUnit: 'GB',
      solveFor: 'size',
      time: 80,
      timeUnit: 's',
    });

    assert.equal(size.value, 1e9);
    assert.match(size.text, /^GB +1$/m);

    assert.equal(
      calculateTransfer({
        overheadPercent: 0,
        rateUnit: 'MB/s',
        size: 1,
        sizeUnit: 'GiB',
        solveFor: 'rate',
        time: 1,
        timeUnit: 'min',
      }).value,
      2 ** 30 / 60,
    );
  });

  it('rejects invalid input', () => {
    const base = {
      overheadPercent: 0,
      rate: 1,
      rateUnit: 'bit/s',
      size: 1,
      sizeUnit: 'B',
      solveFor: 'time',
      timeUnit: 's',
    } as const;

    assert.throws(() => calculateTransfer({ ...base, overheadPercent: 100 }), /0-99/);
    assert.throws(() => calculateTransfer({ ...base, rate: 0 }), /above zero/);
    assert.throws(() => calculateTransfer({ ...base, rateUnit: 'x' }), /valid rate unit/);
    assert.throws(() => calculateTransfer({ ...base, size: 1e308, rate: 1e-300 }), /range/);
  });

  it('formats doubles', () => {
    assert.equal(formatDouble(0.1 + 0.2), '0.3');
  });
});
