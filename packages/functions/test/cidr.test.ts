import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { aggregateCidrs } from '@devtoolora/functions/network';

const a = (text: string) => aggregateCidrs(text);

describe('cidr aggregator', () => {
  it('merges adjacent and contained blocks into minimal CIDRs', () => {
    assert.deepEqual(a('10.0.0.0/24\n10.0.1.0/24\n10.0.1.128/25').merged, ['10.0.0.0/23']);

    assert.deepEqual(a('10.0.0.1 - 10.0.0.6').merged, [
      '10.0.0.1/32',
      '10.0.0.2/31',
      '10.0.0.4/31',
      '10.0.0.6/32',
    ]);

    assert.deepEqual(a('2001:db8::-2001:db8::ff').merged, ['2001:db8::/120']);

    assert.deepEqual(a('2001:db8::/32\n# note\n\n10.0.0.5/24').merged, [
      '10.0.0.0/24',
      '2001:db8::/32',
    ]);

    assert.deepEqual(a('0.0.0.0/0\n::/0\n192.168.0.0/16').merged, ['0.0.0.0/0', '::/0']);
    assert.deepEqual(a('10.0.0.0/25\n10.0.0.128/25').merged, ['10.0.0.0/24']);
    assert.deepEqual(a('203.0.113.7\n2001:db8::1').merged, ['203.0.113.7/32', '2001:db8::1/128']);
    assert.deepEqual(a('10.0.0.2/31\r\n10.0.0.0/31').merged, ['10.0.0.0/30']);
    assert.equal(a('2001:db8::/32\n# note\n\n10.0.0.5/24').inputCount, 2);
  });

  it('lists overlapping pairs in line order', () => {
    assert.deepEqual(a('10.0.0.0/24\n10.0.0.128/25\n10.0.0.100-10.0.1.5').overlaps, [
      'line 1 contains line 2',
      'line 1 overlaps line 3',
      'line 3 contains line 2',
    ]);

    assert.deepEqual(a('10.0.0.128/25\n10.0.0.0/24').overlaps, ['line 2 contains line 1']);
    assert.deepEqual(a('10.0.0.0/24\n10.0.0.0/24').overlaps, ['line 1 contains line 2']);
    assert.deepEqual(a('10.0.0.0/24\n::a00:0/120').overlaps, []);
    assert.equal(a('10.0.0.0/24\n10.0.1.0/24').overlapCount, 0);
  });

  it('caps the overlap list at 1,000 pairs', () => {
    const many = Array.from({ length: 50 }, () => '10.0.0.0/8').join('\n');
    const report = a(many);

    assert.equal(report.overlaps.length, 1000);
    assert.equal(report.overlapsTruncated, true);
    assert.equal(report.overlaps[0], 'line 1 contains line 2');
    assert.equal(a('10.0.0.0/8\n10.0.0.0/8').overlapsTruncated, false);
  });

  it('caps the merged list at 100,000 CIDRs', () => {
    const hostile = Array.from(
      { length: 600 },
      (_, i) => `${i.toString(16)}::1 - ${i.toString(16)}:ffff:ffff:ffff:ffff:ffff:ffff:fffe`,
    ).join('\n');

    assert.throws(() => a(hostile), /The merged list exceeds 100,000 CIDRs\./);
  });

  it('rejects invalid lines with their line number', () => {
    assert.throws(() => a('10.0.0.0/24\nnot an ip'), /^FunctionError: Line 2: /);
    assert.throws(() => a('10.0.0.9 - 10.0.0.1'), /Line 1.*end/);
    assert.throws(() => a('10.0.0.1 - ::1'), /Line 1.*same family/);
    assert.throws(() => a('10.0.0.0/33'), /Line 1.*0 through 32/);
    assert.throws(() => a('2001:db8::/129'), /Line 1.*0 through 128/);
    assert.throws(() => a('10.0.0.1-10.0.0.2-10.0.0.3'), /Line 1/);
    assert.throws(() => a(`10.0.0.1\n${'#'.repeat(129)}`), /Line 2 exceeds 128 characters\./);
    assert.throws(() => a('10.0.0.1\n'.repeat(10_001)), /10,000 lines/);
    assert.throws(() => a('\n# only a comment\n'), /required/);
    assert.equal(a('10.0.0.1\n'.repeat(10_000)).inputCount, 10_000);
  });
});
