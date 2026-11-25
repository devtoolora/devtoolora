import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cronGeneratorTool } from '../src/catalog/devUtilities';

describe('Cron Generator alias', () => {
  it('opens the merged cron tool in Builder and returns only the expression', async () => {
    assert.equal(cronGeneratorTool.aliasOf, 'cron-explain');

    assert.equal(
      cronGeneratorTool.fields?.find((field) => field.id === 'source')?.defaultValue,
      'builder',
    );

    assert.equal(
      cronGeneratorTool.fields?.find((field) => field.id === 'output')?.defaultValue,
      'expression',
    );

    const result = await cronGeneratorTool.run({
      fields: {
        dayOfMonth: '*',
        dayOfWeek: 'mon-fri',
        hour: '9-17',
        minute: '0,30',
        month: '*',
        preset: 'custom',
      },
      text: '',
    });

    assert.equal(result.text, '0,30 9-17 * * MON-FRI');
    assert.equal(result.artifact?.fileName, 'cron-expression.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    const audit = JSON.parse(
      Buffer.from(result.artifacts?.[1]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.equal(audit.result.expression, result.text);
    assert.deepEqual(audit.result.fields[0].values, [0, 30]);
    assert.equal(audit.preset, 'custom');

    assert.equal(
      (await cronGeneratorTool.run({ fields: { preset: 'weekdays9' }, text: '' })).text,
      '0 9 * * 1-5',
    );

    assert.equal(
      (await cronGeneratorTool.run({ fields: { minute: 'invalid', preset: 'hourly' }, text: '' }))
        .text,
      '0 * * * *',
    );

    await assert.rejects(
      async () => cronGeneratorTool.run({ fields: { minute: '*/0', preset: 'custom' }, text: '' }),
      /positive safe/,
    );
  });
});
