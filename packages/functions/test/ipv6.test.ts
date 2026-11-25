import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  classifyIpv6,
  convertIpv6,
  formatIpv6,
  type Ipv6InputFormat,
  ipv6Max,
  parseIpv6,
} from '@devtoolora/functions/network';
import { FunctionError } from '@devtoolora/functions/errors';

const c = (text: string, format?: Ipv6InputFormat) => convertIpv6(text, format);

describe('ipv6 functions', () => {
  it('compresses and expands addresses', () => {
    assert.equal(c('2001:0db8:0000:0000:0000:ff00:0042:8329').compressed, '2001:db8::ff00:42:8329');
    assert.equal(c('2001:db8:0:0:1:0:0:1').compressed, '2001:db8::1:0:0:1');
    assert.equal(c('2001:0:0:1:0:0:0:1').compressed, '2001:0:0:1::1');
    assert.equal(c('2001:db8:0:1:1:1:1:1').compressed, '2001:db8:0:1:1:1:1:1');
    assert.equal(c('::ffff:c000:0201').compressed, '::ffff:192.0.2.1');
    assert.equal(c('::ffff:192.0.2.1').expanded, '0000:0000:0000:0000:0000:ffff:c000:0201');
    assert.equal(c('[FE80::1%eth0]').compressed, 'fe80::1%eth0');
    assert.equal(c('[FE80::1%eth0]').zone, 'eth0');
    assert.equal(c('20010db8000000000000000000000001', 'hex').compressed, '2001:db8::1');
    assert.equal(c('0x20010DB8000000000000000000000001', 'hex').compressed, '2001:db8::1');
    assert.equal(c('281473902969345', 'integer').compressed, '::ffff:192.0.2.1');
    assert.equal(c('1:2:3:4:5:6:7::').compressed, '1:2:3:4:5:6:7:0');
    assert.equal(c('::2:3:4:5:6:7:8').compressed, '0:2:3:4:5:6:7:8');
    assert.equal(formatIpv6(ipv6Max, 'compressed'), 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    assert.equal(formatIpv6(0n, 'compressed'), '::');
    assert.equal(formatIpv6(1n, 'expanded'), '0000:0000:0000:0000:0000:0000:0000:0001');
    assert.equal(ipv6Max, 2n ** 128n - 1n);
  });

  it('writes the conversion report', () => {
    const doc = c('2001:db8::1').text;

    assert.match(
      doc,
      /^PTR +1\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.0\.8\.b\.d\.0\.1\.0\.0\.2\.ip6\.arpa$/m,
    );

    assert.match(doc, /^Hex +0x20010db8000000000000000000000001$/m);
    assert.match(doc, /^Integer +42540766411282592856903984951653826561$/m);
    assert.match(doc, /^Type +Documentation$/m);
    assert.match(doc, /^Binary +0010000000000001 0000110110111000( 0{16}){5} 0{15}1$/m);

    assert.deepEqual(
      doc.split('\n').map((line) => line.split(/ {2,}/)[0]),
      ['Compressed', 'Expanded', 'Hex', 'Integer', 'Binary', 'PTR', 'Type', ''],
    );

    assert.ok(doc.endsWith('\n'));
    assert.match(c('fe80::1%eth0').text, /^Zone +eth0\n$/m);

    const teredo = c('2001:0:4136:e378:8000:63bf:3fff:fdd2').text;

    assert.match(teredo, /^Teredo server +65\.54\.227\.120$/m);
    assert.match(teredo, /^Teredo client +192\.0\.2\.45$/m);
    assert.match(teredo, /^Teredo port +40000$/m);
    assert.match(c('2002:c000:0204::1').text, /^IPv4 +192\.0\.2\.4$/m);
    assert.match(c('::ffff:192.0.2.1').text, /^IPv4 +192\.0\.2\.1$/m);
    assert.match(c('64:ff9b::192.0.2.33').text, /^Type +NAT64 well-known prefix$/m);
    assert.match(c('64:ff9b::192.0.2.33').text, /^IPv4 +192\.0\.2\.33$/m);
  });

  it('classifies address types', () => {
    const type = (text: string) => classifyIpv6(parseIpv6(text).value);

    assert.equal(type('ff02::1'), 'Multicast (link-local scope)');
    assert.equal(type('ff0e::1'), 'Multicast (global scope)');
    assert.equal(type('ff03::1'), 'Multicast (realm-local scope)');
    assert.equal(type('ff0f::1'), 'Multicast (reserved scope)');
    assert.equal(type('fd12:3456:789a::1'), 'Unique local');
    assert.equal(type('2606:4700::1111'), 'Global unicast');
    assert.equal(classifyIpv6(0n), 'Unspecified');
    assert.equal(type('::1'), 'Loopback');
    assert.equal(type('64:ff9b:1::1'), 'Local-use NAT64');
    assert.equal(type('100::1'), 'Discard-only');
    assert.equal(type('2001::1'), 'Teredo');
    assert.equal(type('3fff::1'), 'Documentation');
    assert.equal(type('2002::1'), '6to4');
    assert.equal(type('fe80::1'), 'Link-local');
    assert.equal(type('::2'), 'Reserved');
  });

  it('rejects invalid input', () => {
    for (const bad of [
      ':::',
      '1::2::3',
      '1:2:3:4:5:6:7:8:9',
      '1:2:3:4::5:6:7:8',
      '12345::',
      '1.2.3.4::',
      'fe80::1%',
      'g::1',
      '2001:db8::/64',
      '',
      'a'.repeat(129),
    ])
      assert.throws(() => c(bad), FunctionError);
    assert.throws(() => c('2001:db8::/64'), /IPv6 Subnet Calculator/);
    assert.throws(() => c('1'.repeat(40), 'integer'), FunctionError);
    assert.throws(() => c((2n ** 128n).toString(), 'integer'), FunctionError);
    assert.throws(() => c('1234', 'hex'), FunctionError);
    assert.throws(() => c('a'.repeat(129)), /128 characters/);
  });

  it('labels the rest of the IANA special-purpose list by most specific match', () => {
    const type = (address: string): string => convertIpv6(address).type;

    for (const [address, label] of [
      ['100:0:0:1::1', 'Dummy prefix'],
      ['2001:1::1', 'PCP anycast'],
      ['2001:1::2', 'TURN anycast'],
      ['2001:1::3', 'DNS-SD SRP anycast'],
      ['2001:2::1', 'Benchmarking'],
      ['2001:3::1', 'AMT'],
      ['2001:4:112::1', 'AS112-v6'],
      ['2001:10::1', 'Deprecated ORCHID'],
      ['2001:20::1', 'ORCHIDv2'],
      ['2001:30::1', 'Drone Remote ID'],
      ['2001:1ff::1', 'IETF protocol assignment'],
      ['2001:0:1::1', 'Teredo'],
      ['2001:db8::1', 'Documentation'],
      ['2001:200::1', 'Global unicast'],
      ['2620:4f:8000::1', 'AS112-v6'],
      ['5f00::1', 'SRv6 SIDs'],
    ]) {
      assert.equal(type(address ?? ''), label, address);
    }
  });
});
