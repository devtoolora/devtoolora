import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { cronExplainTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

const decode = (base64 = ''): string => Buffer.from(base64, 'base64').toString('utf8');

describe('Cron explainer and generator tool', () => {
  it('exports the same expression, explanation and audit in every output mode', async () => {
    const fields = {
      expression: '0 9 1 * MON',
      output: 'explanation',
      startAt: '2026-10-16 12:00',
    };
    const readable = await cronExplainTool.run({ fields, text: '' });
    const audit = await cronExplainTool.run({ fields: { ...fields, output: 'report' }, text: '' });
    const expression = await cronExplainTool.run({
      fields: { ...fields, output: 'expression' },
      text: '',
    });

    assert.equal(readable.artifact?.fileName, 'cron-explanation.txt');
    assert.equal(audit.artifact?.fileName, 'cron-report.json');
    assert.equal(expression.text, '0 9 1 * MON');
    assert.equal(decode(readable.artifact?.base64), readable.text);

    assert.deepEqual(
      readable.artifacts?.map((file) => file.fileName),
      ['cron-expression.txt', 'cron-report.json'],
    );

    assert.equal(decode(readable.artifacts?.[1]?.base64), audit.text);
    assert.equal(decode(audit.artifacts?.[1]?.base64), readable.text);
    const report = JSON.parse(audit.text);

    assert.equal(report.result.dayRule, 'or');
    assert.equal(report.timezone, 'UTC');
    assert.equal(report.from, '2026-10-16T12:00:00.000Z');

    assert.deepEqual(
      report.nextRuns.map((run: { text: string }) => run.text),
      [
        'Mon 2026-10-19 09:00 UTC',
        'Mon 2026-10-26 09:00 UTC',
        'Sun 2026-11-01 09:00 UTC',
        'Mon 2026-11-02 09:00 UTC',
        'Mon 2026-11-09 09:00 UTC',
      ],
    );

    assert.match(readable.text, /Next 5 runs \(UTC\):\n- Mon 2026-10-19 09:00 UTC\n/);
    assert.match(readable.summary ?? '', /Next run: Mon 2026-10-19 09:00 UTC/);
  });

  it('runs every sample and builds expressions from presets or custom fields', async () => {
    assert.equal(contentOf(cronExplainTool).documentation?.length, 2);
    assert.equal(contentOf(cronExplainTool).help?.split('\n\n').length, 4);
    assert.equal(cronExplainTool.samples?.length, 15);

    for (const sample of cronExplainTool.samples ?? []) {
      const result = await cronExplainTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.equal(decode(result.artifact?.base64), result.text);
    }

    const custom = await cronExplainTool.run({
      fields: {
        dayOfWeek: 'mon-fri',
        hour: '9-17',
        minute: '0,30',
        output: 'expression',
        preset: 'custom',
        source: 'builder',
      },
      text: '',
    });

    assert.equal(custom.text, '0,30 9-17 * * MON-FRI');

    assert.equal(
      (
        await cronExplainTool.run({
          fields: { minute: 'invalid', output: 'expression', preset: 'hourly', source: 'builder' },
          text: '',
        })
      ).text,
      '0 * * * *',
    );

    assert.match((await cronExplainTool.run({ fields: {}, text: '0 9 * * MON' })).text, /09:00/);

    assert.match(
      (await cronExplainTool.run({ fields: { expression: '* * * * *' }, text: 'invalid' })).text,
      /Every minute/,
    );
  });

  it('lists leap days, impossible dates and the Vixie day rule correctly', async () => {
    const runs = async (
      expression: string,
      extra: Record<string, string> = {},
    ): Promise<string[]> =>
      JSON.parse(
        (
          await cronExplainTool.run({
            fields: { expression, output: 'report', startAt: '2026-10-16', ...extra },
            text: '',
          })
        ).text,
      ).nextRuns.map((run: { text: string }) => run.text);

    assert.deepEqual(await runs('0 0 29 FEB *'), [
      'Tue 2028-02-29 00:00 UTC',
      'Sun 2032-02-29 00:00 UTC',
      'Fri 2036-02-29 00:00 UTC',
      'Wed 2040-02-29 00:00 UTC',
      'Mon 2044-02-29 00:00 UTC',
    ]);

    assert.deepEqual(await runs('0 0 31 APR *'), []);

    assert.deepEqual(await runs('0 9 */2 * MON', { runs: '10' }), [
      'Mon 2026-10-19 09:00 UTC',
      'Mon 2026-11-09 09:00 UTC',
      'Mon 2026-11-23 09:00 UTC',
      'Mon 2026-12-07 09:00 UTC',
      'Mon 2026-12-21 09:00 UTC',
      'Mon 2027-01-11 09:00 UTC',
      'Mon 2027-01-25 09:00 UTC',
      'Mon 2027-02-01 09:00 UTC',
      'Mon 2027-02-15 09:00 UTC',
      'Mon 2027-03-01 09:00 UTC',
    ]);

    assert.deepEqual(
      (await runs('*/15 * * * *', { runs: '25', startAt: '2026-10-16 23:50' })).slice(0, 2),
      ['Sat 2026-10-17 00:00 UTC', 'Sat 2026-10-17 00:15 UTC'],
    );

    assert.match(
      (
        await cronExplainTool.run({
          fields: { expression: '0 0 31 APR *', startAt: '2026-10-16' },
          text: '',
        })
      ).text,
      /No run in the next 25 years \(UTC\)\./,
    );
  });

  it('names a start time that falls inside a daylight saving gap', async () => {
    vi.stubEnv('TZ', 'America/New_York');

    try {
      await assert.rejects(
        async () =>
          cronExplainTool.run({
            fields: { startAt: '2026-03-08 02:30', timezone: 'local' },
            text: '0 9 * * *',
          }),
        /does not exist on that day/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects empty expressions, malformed builder fields and unknown options', async () => {
    await assert.rejects(
      async () => cronExplainTool.run({ fields: { expression: '' }, text: '* * * * *' }),
      /five fields/,
    );

    await assert.rejects(
      async () => cronExplainTool.run({ fields: { output: 'unknown' }, text: '' }),
      /Choose/,
    );

    await assert.rejects(
      async () => cronExplainTool.run({ fields: { source: 'guess' }, text: '' }),
      /Choose Expression or Builder/,
    );

    await assert.rejects(
      async () => cronExplainTool.run({ fields: { timezone: 'mars' }, text: '' }),
      /Choose UTC/,
    );

    await assert.rejects(
      async () => cronExplainTool.run({ fields: { runs: '7' }, text: '' }),
      /Choose 5, 10 or 25/,
    );

    await assert.rejects(
      async () => cronExplainTool.run({ fields: { startAt: '2026-02-30' }, text: '' }),
      /YYYY-MM-DD/,
    );

    await assert.rejects(
      async () => cronExplainTool.run({ fields: { expression: '*/0 * * * *' }, text: '' }),
      /positive safe/,
    );

    await assert.rejects(
      async () =>
        cronExplainTool.run({ fields: { preset: 'unknown', source: 'builder' }, text: '' }),
      /Unknown presets/,
    );

    await assert.rejects(
      async () =>
        cronExplainTool.run({
          fields: { hour: '', minute: '0 9', preset: 'custom', source: 'builder' },
          text: '',
        }),
      /Minute must contain one nonempty cron field/,
    );

    await assert.rejects(
      async () =>
        cronExplainTool.run({
          fields: { dayOfMonth: 'x'.repeat(257), preset: 'custom', source: 'builder' },
          text: '',
        }),
      /Day of month is limited to 256/,
    );
  });
});
