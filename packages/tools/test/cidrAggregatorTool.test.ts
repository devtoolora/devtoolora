import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cidrAggregatorTool } from '../src/catalog/network';
import { contentOf } from './toolContent';

describe('cidr aggregator tool', () => {
  it('declares its fields', () => {
    assert.equal(cidrAggregatorTool.id, 'cidr-aggregator');
    assert.equal(cidrAggregatorTool.name, 'CIDR Aggregator & Overlap Checker');
    assert.equal(cidrAggregatorTool.category, 'Network');
    assert.equal(cidrAggregatorTool.inputKind, 'text');
    assert.equal(cidrAggregatorTool.outputKind, 'text');

    assert.deepEqual(
      cidrAggregatorTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['report', 'Report', 'merged']],
    );

    assert.deepEqual(cidrAggregatorTool.relatedToolIds, [
      'ipv4-subnet',
      'ipv6-subnet',
      'ipv4-range',
    ]);

    assert.equal(contentOf(cidrAggregatorTool).faq?.length, 4);
    assert.equal(cidrAggregatorTool.samples?.length, 6);
  });

  it('reports merged CIDRs and exports the text', async () => {
    const result = await cidrAggregatorTool.run({
      fields: { report: 'merged' },
      text: '# office\n2001:db8::/32\n10.0.0.5/24\n\n10.0.1.0/24',
    });

    assert.equal(result.text, '10.0.0.0/23\n2001:db8::/32\n');
    assert.equal(result.summary, '3 inputs → 2 CIDRs · 0 overlapping pairs');
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, 'cidr-aggregator.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    const single = await cidrAggregatorTool.run({ fields: { report: 'merged' }, text: '10.0.0.1' });

    assert.equal(single.summary, '1 input → 1 CIDR · 0 overlapping pairs');
  });

  it('reports overlapping lines', async () => {
    const result = await cidrAggregatorTool.run({
      fields: { report: 'overlaps' },
      text: '10.0.0.0/24\n10.0.0.128/25',
    });

    assert.equal(result.text, 'line 1 contains line 2\n');
    assert.equal(result.summary, '2 inputs → 1 CIDR · 1 overlapping pair');

    const clean = await cidrAggregatorTool.run({
      fields: { report: 'overlaps' },
      text: '10.0.0.0/24\n10.0.1.0/24',
    });

    assert.equal(clean.text, 'No overlapping lines.\n');

    const many = await cidrAggregatorTool.run({
      fields: { report: 'overlaps' },
      text: Array.from({ length: 50 }, () => '10.0.0.0/8').join('\n'),
    });

    assert.equal(many.text.trimEnd().split('\n').length, 1000);
    assert.equal(many.summary, '50 inputs → 1 CIDR · more than 1,000 overlapping pairs');
  });

  it('reports errors', async () => {
    await assert.rejects(
      async () =>
        cidrAggregatorTool.run({ fields: { report: 'merged' }, text: '10.0.0.9 - 10.0.0.1' }),
      { message: 'Line 1: The range end must not be before its start.' },
    );

    await assert.rejects(
      async () => cidrAggregatorTool.run({ fields: { report: 'all' }, text: '10.0.0.0/24' }),
      { message: 'Choose merged CIDRs or overlaps.' },
    );
  });
});
