import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ipv6ConverterTool } from '../src/catalog/network';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

describe('ipv6 converter tool', () => {
  it('declares its fields', () => {
    assert.equal(ipv6ConverterTool.id, 'ipv6-converter');
    assert.equal(ipv6ConverterTool.name, 'IPv6 Address Converter');
    assert.equal(ipv6ConverterTool.category, 'Network');
    assert.equal(ipv6ConverterTool.inputKind, 'text');
    assert.equal(ipv6ConverterTool.outputKind, 'text');

    assert.deepEqual(
      ipv6ConverterTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['format', 'Input format', 'address']],
    );

    assert.deepEqual(
      fieldsOf(ipv6ConverterTool)?.[0]?.options?.map(({ label }) => label),
      ['Address', '32 hex digits', 'Integer'],
    );

    assert.deepEqual(ipv6ConverterTool.relatedToolIds, ['ipv6-ula', 'ipv4-converter']);
    assert.equal(contentOf(ipv6ConverterTool).faq?.length, 4);
    assert.ok((ipv6ConverterTool.samples?.length ?? 0) >= 6);
  });

  it('converts an address and exports the text', async () => {
    const result = await ipv6ConverterTool.run({
      fields: { format: 'address' },
      text: '[FE80::1%eth0]',
    });

    assert.equal(result.summary, 'Link-local · compressed fe80::1%eth0 · zone eth0');
    assert.equal(result.language, 'plaintext');
    assert.match(result.text, /^Compressed {2}fe80::1%eth0\n/);
    assert.equal(result.artifact?.fileName, 'ipv6-conversion.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('converts hex and integer input', async () => {
    const hex = await ipv6ConverterTool.run({
      fields: { format: 'hex' },
      text: '20010db8000000000000000000000001',
    });

    assert.equal(hex.summary, 'Documentation · compressed 2001:db8::1');

    const integer = await ipv6ConverterTool.run({
      fields: { format: 'integer' },
      text: '281473902969345',
    });

    assert.equal(integer.summary, 'IPv4-mapped · compressed ::ffff:192.0.2.1');
  });

  it('reports errors and rejects unknown choices', async () => {
    await assert.rejects(
      async () => ipv6ConverterTool.run({ fields: { format: 'address' }, text: '2001:db8::/64' }),
      {
        message:
          'Enter one IPv6 address without a /prefix; use IPv6 Subnet Calculator for CIDR blocks.',
      },
    );

    await assert.rejects(
      async () => ipv6ConverterTool.run({ fields: { format: '__proto__' }, text: '::1' }),
      { message: 'Choose address, 32 hex digits or integer input.' },
    );
  });
});
