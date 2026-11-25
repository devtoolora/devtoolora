import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ipv6SubnetTool } from '../src/catalog/network';
import { contentOf } from './toolContent';

describe('ipv6 subnet tool', () => {
  it('declares its fields', () => {
    assert.equal(ipv6SubnetTool.id, 'ipv6-subnet');
    assert.equal(ipv6SubnetTool.name, 'IPv6 Subnet Calculator');
    assert.equal(ipv6SubnetTool.category, 'Network');
    assert.equal(ipv6SubnetTool.inputKind, 'text');
    assert.equal(ipv6SubnetTool.outputKind, 'text');

    assert.deepEqual(
      ipv6SubnetTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['split', 'Split into prefix', '']],
    );

    assert.deepEqual(ipv6SubnetTool.relatedToolIds, ['ipv6-converter', 'ipv4-subnet', 'ipv6-ula']);
    assert.equal(contentOf(ipv6SubnetTool).faq?.length, 4);
    assert.equal(ipv6SubnetTool.samples?.length, 6);
  });

  it('calculates a block and exports the text', async () => {
    const result = await ipv6SubnetTool.run({
      fields: { split: '' },
      text: '2001:db8:abcd:12::/48',
    });

    assert.equal(result.summary, '1208925819614629174706176 addresses · host bits ignored');
    assert.equal(result.language, 'plaintext');
    assert.match(result.text, /^Network {8}2001:db8:abcd::\/48\n/);
    assert.equal(result.artifact?.fileName, 'ipv6-subnet.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('splits with or without a slash and reports truncation', async () => {
    const small = await ipv6SubnetTool.run({ fields: { split: '/64' }, text: '2001:db8::/62' });

    assert.equal(small.summary, '73786976294838206464 addresses');
    assert.match(small.text, /\n2001:db8:0:3::\/64\n$/);

    const big = await ipv6SubnetTool.run({ fields: { split: '64' }, text: '2001:db8::/48' });

    assert.match(big.summary ?? '', / · first 1,024 of 65536 subnets listed$/);

    const single = await ipv6SubnetTool.run({ fields: { split: '' }, text: '2001:db8::1/128' });

    assert.equal(single.summary, '1 address');
  });

  it('reports errors', async () => {
    await assert.rejects(
      async () => ipv6SubnetTool.run({ fields: { split: '' }, text: '2001:db8::/129' }),
      { message: 'The IPv6 prefix must be a whole number from 0-128.' },
    );

    await assert.rejects(
      async () => ipv6SubnetTool.run({ fields: { split: 'abc' }, text: '2001:db8::/64' }),
      { message: 'Split prefix must be a whole number such as 64 or /64.' },
    );
  });
});
