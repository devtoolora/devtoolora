import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ieee754InspectorTool } from '../src/catalog/math';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

const run = (text: string, format: string) =>
  ieee754InspectorTool.run({ fields: { format }, text });

describe('IEEE 754 float inspector tool', () => {
  it('declares its fields', () => {
    assert.equal(ieee754InspectorTool.id, 'ieee754-inspector');
    assert.equal(ieee754InspectorTool.name, 'IEEE 754 Float Inspector');
    assert.equal(ieee754InspectorTool.category, 'Math');
    assert.equal(ieee754InspectorTool.inputKind, 'text');
    assert.equal(ieee754InspectorTool.outputKind, 'text');

    assert.deepEqual(
      ieee754InspectorTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['format', 'Format', 'binary32']],
    );

    assert.deepEqual(
      fieldsOf(ieee754InspectorTool)?.[0]?.options?.map(({ label }) => label),
      ['Half (16-bit)', 'Single (32-bit)', 'Double (64-bit)'],
    );

    assert.deepEqual(ieee754InspectorTool.relatedToolIds, ['base-converter', 'bitwise-calculator']);
    assert.equal(contentOf(ieee754InspectorTool).faq?.length, 4);
    assert.ok((ieee754InspectorTool.samples?.length ?? 0) >= 6);
  });

  it('inspects every format', async () => {
    const half = await run('1', 'binary16');
    const single = await run('0.1', 'binary32');
    const double = await run('0.1', 'binary64');

    assert.equal(half.summary, 'normal · 0x3c00 · binary16');
    assert.equal(single.summary, 'normal · 0x3dcccccd · binary32');
    assert.equal(double.summary, 'normal · 0x3fb999999999999a · binary64');
    assert.match(single.text, /^Hex +0x3dcccccd\n/);
    assert.equal(single.language, 'plaintext');
    assert.equal(single.artifact?.fileName, 'ieee754.txt');

    assert.equal(
      Buffer.from(single.artifact?.base64 ?? '', 'base64').toString('utf8'),
      single.text,
    );
  });

  it('runs every sample', async () => {
    for (const sample of ieee754InspectorTool.samples ?? []) {
      const result = await ieee754InspectorTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.match(result.text, /^Hex /, sample.label);
    }
  });

  it('reports errors', async () => {
    await assert.rejects(async () => run('0x3c00', 'binary32'), {
      message: 'A binary32 bit pattern is 0x followed by exactly 8 hex digits.',
    });

    await assert.rejects(async () => run('1', 'binary128'), {
      message: 'Choose half, single or double precision.',
    });
  });
});
