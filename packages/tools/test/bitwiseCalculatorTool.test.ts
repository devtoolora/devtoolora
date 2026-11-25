import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { bitwiseCalculatorTool, programmerCalculatorTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

describe('bitwise calculator tool', () => {
  it('declares its fields and conditions', () => {
    assert.equal(bitwiseCalculatorTool.id, 'bitwise-calculator');
    assert.equal(bitwiseCalculatorTool.name, 'Bitwise Calculator');
    assert.equal(bitwiseCalculatorTool.category, 'Dev Utilities');
    assert.equal(bitwiseCalculatorTool.inputKind, 'none');
    assert.equal(bitwiseCalculatorTool.outputKind, 'text');
    assert.equal(bitwiseCalculatorTool.autoRun, true);

    assert.deepEqual(
      bitwiseCalculatorTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['a', 'A', '12'],
        ['operation', 'Operation', 'and'],
        ['b', 'B or shift amount', '10'],
        ['width', 'Width', '32'],
      ],
    );

    assert.deepEqual(bitwiseCalculatorTool.fields?.[2]?.visibleWhen, {
      field: 'operation',
      isNot: ['not'],
    });

    assert.deepEqual(bitwiseCalculatorTool.relatedToolIds, [
      'base-converter',
      'chmod-calculator',
      'math-evaluator',
    ]);

    assert.equal(contentOf(bitwiseCalculatorTool).faq?.length, 6);
    assert.ok((bitwiseCalculatorTool.samples?.length ?? 0) >= 6);
  });

  it('calculates and exports the text', async () => {
    const result = await bitwiseCalculatorTool.run({
      fields: { a: '12', b: '10', operation: 'and', width: '32' },
      text: '',
    });

    assert.equal(result.summary, 'Result 0x00000008: 8 unsigned, 8 signed.');
    assert.equal(result.language, 'plaintext');
    assert.match(result.text, /^A AND B \(32-bit\)\n/);
    assert.equal(result.artifact?.fileName, 'bitwise.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('runs every sample', async () => {
    for (const sample of bitwiseCalculatorTool.samples ?? []) {
      const result = await bitwiseCalculatorTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.match(result.summary ?? '', /^Result 0x[0-9A-F]+: \d+ unsigned, -?\d+ signed\.$/);
    }
  });

  it('reports errors and rejects unknown choices', async () => {
    await assert.rejects(
      async () =>
        bitwiseCalculatorTool.run({
          fields: { a: '256', b: '1', operation: 'and', width: '8' },
          text: '',
        }),
      { message: 'A must fit 8 bits: -128 to 255.' },
    );

    const messages = {
      operation: 'Choose an operation.',
      width: 'Choose 8, 16, 32 or 64 bits.',
    };

    for (const [field, message] of Object.entries(messages))
      await assert.rejects(
        async () =>
          bitwiseCalculatorTool.run({ fields: { a: '1', b: '1', [field]: '__proto__' }, text: '' }),
        { message },
      );
  });

  it('offers arithmetic operations and flags', async () => {
    const operation = bitwiseCalculatorTool.fields?.[1];
    const options = operation?.type === 'select' ? operation.options : [];

    assert.deepEqual(
      options.slice(-7).map(({ label, value }) => [value, label]),
      [
        ['add', 'Add'],
        ['sub', 'Subtract'],
        ['mul', 'Multiply'],
        ['udiv', 'Divide (unsigned)'],
        ['urem', 'Remainder (unsigned)'],
        ['sdiv', 'Divide (signed)'],
        ['srem', 'Remainder (signed)'],
      ],
    );

    const result = await bitwiseCalculatorTool.run({
      fields: { a: '200', b: '100', operation: 'add', width: '8' },
      text: '',
    });

    assert.match(result.text, /\nFlags: carry yes, overflow no\n$/);

    await assert.rejects(
      async () =>
        bitwiseCalculatorTool.run({
          fields: { a: '1', b: '0', operation: 'udiv', width: '8' },
          text: '',
        }),
      { message: 'Division by zero.' },
    );
  });

  it('exposes the programmer calculator alias', () => {
    const defaultOf = (tool: typeof bitwiseCalculatorTool) =>
      tool.fields?.find((field) => field.id === 'operation')?.defaultValue;

    assert.equal(programmerCalculatorTool.id, 'programmer-calculator');
    assert.equal(programmerCalculatorTool.name, 'Programmer Calculator');
    assert.equal(programmerCalculatorTool.aliasOf, 'bitwise-calculator');
    assert.equal(defaultOf(programmerCalculatorTool), 'add');
    assert.equal(defaultOf(bitwiseCalculatorTool), 'and');
  });
});
