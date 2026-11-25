import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { calculateIpv6Subnet } from '@devtoolora/functions/network';

describe('ipv6 subnet', () => {
  it('calculates a block and ignores host bits', () => {
    const s = calculateIpv6Subnet('2001:db8:abcd:12::/48');

    assert.equal(s.network, '2001:db8:abcd::/48');
    assert.equal(s.hostBitsSet, true);
    assert.equal(s.total, 1208925819614629174706176n);
    assert.match(s.text, /^Addresses +1208925819614629174706176 \(2\^80\)$/m);
    assert.match(s.text, /^First address +2001:db8:abcd::$/m);
    assert.match(s.text, /^Last address +2001:db8:abcd:ffff:ffff:ffff:ffff:ffff$/m);
    assert.match(s.text, /^Prefix mask +ffff:ffff:ffff::$/m);
    assert.match(s.text, /^\/64 networks +65536$/m);
    assert.ok(s.text.endsWith('\n'));
  });

  it('lists split subnets up to the limit', () => {
    assert.deepEqual(calculateIpv6Subnet('2001:db8::/62', 64).subnets, [
      '2001:db8::/64',
      '2001:db8:0:1::/64',
      '2001:db8:0:2::/64',
      '2001:db8:0:3::/64',
    ]);

    const big = calculateIpv6Subnet('2001:db8::/48', 64);

    assert.equal(big.subnets.length, 1024);
    assert.equal(big.subnetTotal, 65536n);
    assert.match(big.text, /^Subnets \/64 \(first 1,024 of 65536\)$/m);
    assert.match(calculateIpv6Subnet('2001:db8::/62', 64).text, /^Subnets \/64 \(4\)$/m);
  });

  it('handles the extremes', () => {
    assert.equal(calculateIpv6Subnet('::/0').total, 2n ** 128n);
    assert.doesNotMatch(calculateIpv6Subnet('2001:db8::1/128').text, /\/64 networks/);
    assert.equal(calculateIpv6Subnet('2001:db8::1/128').hostBitsSet, false);
  });

  it('rejects bad input', () => {
    assert.throws(() => calculateIpv6Subnet('2001:db8::/129'), /0-128/);
    assert.throws(() => calculateIpv6Subnet('2001:db8::/64', 63), /from \/64 through \/128/);
    assert.throws(() => calculateIpv6Subnet('2001:db8::/64', 129), /from \/64 through \/128/);
    assert.throws(() => calculateIpv6Subnet('2001:db8::'), /prefix/);
    assert.throws(() => calculateIpv6Subnet('2001:db8::/x'), /0-128/);
    assert.throws(() => calculateIpv6Subnet('a'.repeat(129)), /128 characters/);
  });
});
