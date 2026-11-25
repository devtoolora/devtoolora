import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { isIP } from 'node:net';
import {
  calculateIpv4Subnet,
  convertIpv4,
  createMacAddress,
  expandIpv4Range,
  generateIpv6Ula,
  generateIpv6UlaPlan,
  intToIpv4,
  ipv4ToInt,
  parseIpv6,
} from '@devtoolora/functions/network';
import { FunctionError } from '@devtoolora/functions/errors';

describe('network functions', () => {
  it('converts IPv4 values and calculates subnets', () => {
    assert.equal(intToIpv4(ipv4ToInt('192.168.1.10')), '192.168.1.10');
    assert.equal(convertIpv4('192.168.1.10').hex, '0xc0a8010a');
    const subnet = calculateIpv4Subnet('192.168.1.10/24');

    assert.equal(subnet.networkAddress, '192.168.1.0');
    assert.equal(subnet.broadcastAddress, '192.168.1.255');

    assert.deepEqual(expandIpv4Range('192.168.1.0/30'), [
      '192.168.1.0',
      '192.168.1.1',
      '192.168.1.2',
      '192.168.1.3',
    ]);
  });

  it('generates locally scoped address values', () => {
    assert.match(createMacAddress(), /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/);
    assert.match(generateIpv6Ula(), /^fd[0-9a-f:]+::\/48$/);
  });

  it('rejects invalid addresses with stable codes', () => {
    assert.throws(
      () => ipv4ToInt('999.1.1.1'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_IPV4',
    );
  });

  it('rejects ambiguous octets and out-of-range unsigned integers', () => {
    for (const value of [
      '1..2.3',
      '01.2.3.4',
      '+1.2.3.4',
      '0x1.2.3.4',
      '1e1.2.3.4',
      '1. 2.3.4',
      '256.2.3.4',
      '1.2.3',
    ]) {
      assert.throws(() => ipv4ToInt(value), FunctionError);
    }

    for (const value of [-1, 0.5, NaN, Infinity, 4294967296])
      assert.throws(() => intToIpv4(value), FunctionError);
    assert.equal(ipv4ToInt('255.255.255.255'), 4294967295);
    assert.equal(intToIpv4(0), '0.0.0.0');
    assert.throws(() => ipv4ToInt(' '.repeat(129) + '1.2.3.4'), FunctionError);
  });

  it('converts explicit integer, hex and binary formats without partial parsing', () => {
    const expected = convertIpv4('192.168.1.10');

    assert.deepEqual(convertIpv4('3232235786', 'integer'), expected);
    assert.deepEqual(convertIpv4('0xC0A8010A', 'hex'), expected);
    assert.deepEqual(convertIpv4('11000000.10101000.00000001.00001010', 'binary'), expected);
    assert.equal(convertIpv4('0b10', 'binary').integer, 2);
    assert.equal(convertIpv4('0B10', 'binary').integer, 2);
    assert.equal(convertIpv4('0X0A', 'hex').integer, 10);
    assert.equal(convertIpv4('10', 'integer').integer, 10);
    assert.equal(convertIpv4('ff', 'hex').dotted, '0.0.0.255');
    for (const value of ['4294967296', '-1', '1.5', '1e2'])
      assert.throws(() => convertIpv4(value, 'integer'), FunctionError);
    for (const value of ['ffjunk', '0x', '100000000'])
      assert.throws(() => convertIpv4(value, 'hex'), FunctionError);
    for (const value of ['102', '1'.repeat(33), '00000000.0.0.0', '0b', '0B2'])
      assert.throws(() => convertIpv4(value, 'binary'), FunctionError);
  });

  it('calculates unsigned subnet boundaries for every prefix and /31 or /32 host models', () => {
    for (let prefix = 0; prefix <= 32; prefix += 1) {
      const subnet = calculateIpv4Subnet(`255.255.255.255/${prefix}`);

      assert.equal(subnet.totalAddresses, 2 ** (32 - prefix));
      assert.equal(ipv4ToInt(subnet.subnetMask) + ipv4ToInt(subnet.wildcardMask), 4294967295);

      assert.equal(
        ipv4ToInt(subnet.lastAddress) - ipv4ToInt(subnet.networkAddress) + 1,
        subnet.totalAddresses,
      );

      assert.equal(
        subnet.hostCount,
        prefix >= 31 ? subnet.totalAddresses : subnet.totalAddresses - 2,
      );

      assert.equal(subnet.broadcastAddress, prefix >= 31 ? null : '255.255.255.255');
    }

    assert.equal(calculateIpv4Subnet('203.0.113.11/31').firstHost, '203.0.113.10');
    assert.equal(calculateIpv4Subnet('203.0.113.11/32').lastHost, '203.0.113.11');

    for (const value of [
      '1.2.3.4',
      '1.2.3.4/',
      '1.2.3.4/33',
      '1.2.3.4/-1',
      '1.2.3.4/2.5',
      '1.2.3.4/01',
      '1.2.3.4/24/1',
      '1.2.3.4 /24',
    ]) {
      assert.throws(() => calculateIpv4Subnet(value), FunctionError);
    }
  });

  it('expands inclusive high-address ranges with an exact 1024-address limit', () => {
    assert.deepEqual(expandIpv4Range('192.168.1.10-12'), [
      '192.168.1.10',
      '192.168.1.11',
      '192.168.1.12',
    ]);

    assert.deepEqual(expandIpv4Range('255.255.255.254-255'), [
      '255.255.255.254',
      '255.255.255.255',
    ]);

    assert.deepEqual(expandIpv4Range('192.168.1.254 - 192.168.2.1'), [
      '192.168.1.254',
      '192.168.1.255',
      '192.168.2.0',
      '192.168.2.1',
    ]);

    assert.deepEqual(expandIpv4Range('203.0.113.11/31'), ['203.0.113.10', '203.0.113.11']);
    assert.deepEqual(expandIpv4Range('203.0.113.11/32'), ['203.0.113.11']);
    assert.equal(expandIpv4Range('192.168.0.0/22').length, 1024);

    for (const value of [
      '192.168.0.0-192.168.4.0',
      '192.168.0.0/21',
      '192.168.1.10-',
      '192.168.1.10-9',
      '192.168.1.10-256',
      '192.168.1.10-01',
      '192.168.1.10-1.5',
      '192.168.1.10-11-12',
    ]) {
      assert.throws(() => expandIpv4Range(value), FunctionError);
    }
  });

  it('generates valid IPv6 /48 prefixes and coherent allocation reports', () => {
    for (let index = 0; index < 20; index += 1) {
      const plan = generateIpv6UlaPlan();

      const site = parseIpv6(plan.prefix.replace('/48', '')).value;

      assert.match(plan.prefix, /^fd[0-9a-f]{2}(?::[0-9a-f]{1,4}){0,2}::\/48$/);
      assert.equal(isIP(plan.exampleHost), 6);
      assert.equal(parseIpv6(plan.exampleSubnet.replace('/64', '')).value, site | (1n << 64n));
      assert.equal(plan.globalId, (site >> 80n).toString(16).slice(2));
      assert.equal(plan.subnetCount, 65536);
      const mac = createMacAddress();

      assert.equal(parseInt(mac.slice(0, 2), 16) & 3, 2);
    }
  });

  it('uses exactly five secure bytes for ULA and refuses a weak randomness fallback', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

    try {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {
          getRandomValues: (bytes: Uint8Array): Uint8Array => {
            assert.equal(bytes.length, 5);
            bytes.set([0x12, 0x34, 0x56, 0x78, 0x9a]);

            return bytes;
          },
        },
      });

      assert.equal(generateIpv6Ula(), 'fd12:3456:789a::/48');

      const planFor = (bytes: number[]) => {
        Object.defineProperty(globalThis, 'crypto', {
          configurable: true,
          value: {
            getRandomValues: (target: Uint8Array): Uint8Array => {
              target.set(bytes);

              return target;
            },
          },
        });

        return generateIpv6UlaPlan();
      };

      assert.deepEqual(planFor([0x4c, 0xf9, 0x71, 0x01, 0x41]), {
        exampleHost: 'fd4c:f971:141:1::1',
        exampleSubnet: 'fd4c:f971:141:1::/64',
        globalId: '4cf9710141',
        prefix: 'fd4c:f971:141::/48',
        subnetCount: 65536,
      });

      assert.deepEqual(planFor([0x4c, 0xf9, 0x71, 0, 0]), {
        exampleHost: 'fd4c:f971:0:1::1',
        exampleSubnet: 'fd4c:f971:0:1::/64',
        globalId: '4cf9710000',
        prefix: 'fd4c:f971::/48',
        subnetCount: 65536,
      });

      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

      for (const generate of [generateIpv6Ula, createMacAddress]) {
        assert.throws(
          generate,
          (error: unknown) =>
            error instanceof FunctionError && error.code === 'SECURE_RANDOM_UNAVAILABLE',
        );
      }
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });
});
