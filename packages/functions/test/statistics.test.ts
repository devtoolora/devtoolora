import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { describeNumbers } from '@devtoolora/functions/math';

describe('describeNumbers', () => {
  it('reports no mode for tens of thousands of distinct values', () => {
    const d = describeNumbers(Array.from({ length: 70_000 }, (_, i) => i).join(' '));

    assert.equal(d.count, 70_000);
    assert.match(d.text, /^Mode +none$/m);
  });

  it('computes the descriptive statistics', () => {
    const d = describeNumbers('2, 4; 4 4\n5 5 7 9');

    assert.equal(d.count, 8);

    for (const row of [
      /^Mean +5$/m,
      /^Median +4\.5$/m,
      /^Mode +4$/m,
      /^Population std dev +2$/m,
      /^Sample std dev +2\.1380899352994$/m,
      /^P25 +4$/m,
      /^P75 +5\.5$/m,
      /^P90 +7\.6$/m,
      /^P95 +8\.3$/m,
      /^P99 +8\.86$/m,
      /^IQR +1\.5$/m,
      /^Range +7$/m,
    ]) {
      assert.match(d.text, row);
    }

    assert.ok(d.text.endsWith('\n'));
    assert.equal(d.json.mean, 5);
    assert.deepEqual(d.json.mode, [4]);
  });

  it('handles modes, sparse data and sums', () => {
    assert.match(describeNumbers('1 2 3').text, /^Mode +none$/m);
    assert.equal(describeNumbers('1 2 3').json.mode, null);
    assert.match(describeNumbers('1 1 2 2 3').text, /^Mode +1, 2$/m);
    assert.doesNotMatch(describeNumbers('42').text, /Sample/);
    assert.equal(describeNumbers('42').json.sampleVariance, null);
    assert.match(describeNumbers('0.1 0.2').text, /^Sum +0\.3$/m);
  });

  it('rounds JSON to 15 significant digits', () => {
    assert.equal(describeNumbers('0.1 0.2').json.sum, 0.3);
    assert.equal(describeNumbers('2, 4; 4 4\n5 5 7 9').json.sampleStdDev, 2.1380899352994);
  });

  it('sums with compensation', () => {
    assert.match(describeNumbers('1e16 1 -1e16').text, /^Sum +1$/m);
  });

  it('reports the geometric mean only for positive values', () => {
    assert.doesNotMatch(describeNumbers('-1 2').text, /Geometric/);
    assert.equal(describeNumbers('-1 2').json.geometricMean, null);
    assert.match(describeNumbers('1 4 16').text, /^Geometric mean +4$/m);
  });

  it('adds a custom percentile', () => {
    const d = describeNumbers('1 2 3 4', { percentile: 10 });

    assert.match(d.text, /^P10 +1\.3$/m);
    assert.equal(d.json.p10, 1.3);
  });

  it('rejects invalid input', () => {
    assert.throws(() => describeNumbers(','), /A list of numbers is required\./);
    assert.throws(() => describeNumbers('1', { percentile: 101 }), /0 to 100/);
    assert.throws(() => describeNumbers('1 2 x 4'), /"x" at position 3/);
    assert.throws(() => describeNumbers('1e999'), /"1e999" at position 1/);
    assert.throws(() => describeNumbers('1e308 1e308'), /double range/);
    assert.throws(() => describeNumbers(''), /required/);
    assert.throws(() => describeNumbers('1 '.repeat(100_001)), /100,000 numbers/);
    assert.throws(() => describeNumbers('1'.repeat(5_000_001)), /5,000,000/);
  });

  it('handles the largest allowed input quickly', () => {
    const d = describeNumbers('1 '.repeat(100_000));

    assert.equal(d.count, 100_000);
  });

  it('shows min, max and mode as entered, whatever their length', () => {
    const big = describeNumbers('1700000000000123 1700000000000456');

    assert.match(big.text, /^Min\s+1700000000000123$/m);
    assert.match(big.text, /^Max\s+1700000000000456$/m);
    assert.equal(big.json.min, 1700000000000123);
    assert.equal(big.json.max, 1700000000000456);

    const repeated = describeNumbers('1700000000000123 1700000000000123 1');

    assert.match(repeated.text, /^Mode\s+1700000000000123$/m);
    assert.deepEqual(repeated.json.mode, [1700000000000123]);
    assert.match(describeNumbers('0.1 0.2').text, /^Sum\s+0\.3$/m);
  });
});
