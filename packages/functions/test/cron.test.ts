import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cronPreset, inspectCronExpression, nextCronRuns, parseCronExpression } from '../src/dev';

const explain = (expression: string): string => inspectCronExpression(expression).text;

describe('five-field cron syntax', () => {
  it('expands bounded wildcard, list, range and step values without interval claims', () => {
    const report = parseCronExpression('*/35 9-17/2 1,15 JAN,APR,JUL,OCT MON-FRI');

    assert.deepEqual(
      report.fields.map((field) => field.values),
      [
        [0, 35],
        [9, 11, 13, 15, 17],
        [1, 15],
        [1, 4, 7, 10],
        [1, 2, 3, 4, 5],
      ],
    );

    assert.deepEqual(parseCronExpression('5-59/15 * * * *').fields[0]!.values, [5, 20, 35, 50]);
    const all = parseCronExpression('* * * * *');

    assert.deepEqual(
      all.fields.map((field) => field.values.length),
      [60, 24, 31, 12, 7],
    );

    assert.equal(parseCronExpression('0 0 31 APR *').fields[2]!.values[0], 31);
  });

  it('canonicalizes English names and field whitespace while retaining original expression', () => {
    const original = ' \t0  9\t* jan-mar mon,wed,fri\r\n';
    const report = parseCronExpression(original);

    assert.equal(report.originalInput, original);
    assert.equal(report.expression, '0 9 * JAN-MAR MON,WED,FRI');
    assert.deepEqual(report.fields[3]!.values, [1, 2, 3]);
    assert.deepEqual(parseCronExpression('0 0 * * 0,7,SUN').fields[4]!.values, [0]);
    assert.deepEqual(parseCronExpression('0 0 * * 1-7').fields[4]!.values, [0, 1, 2, 3, 4, 5, 6]);
  });

  it('rejects invalid bounds, empty lists, descending ranges and unsupported dialect syntax', () => {
    for (const expression of [
      '60 * * * *',
      '* 24 * * *',
      '* * 0 * *',
      '* * * 13 *',
      '* * * * 8',
      '*/0 * * * *',
      '*/1.5 * * * *',
      '*/9007199254740992 * * * *',
      '5/15 * * * *',
      '10-5 * * * *',
      '1,,2 * * * *',
      '1, * * * *',
      '* * * * MON-SUN',
      '* * * FOO *',
      '* * * * ?',
      '* * L * *',
      'H * * * *',
      '0~10 * * * *',
      '@daily',
      '* * *',
      '0 * * * * *',
      '* * * * * echo hi',
      '0 0\n* * *',
    ])
      assert.throws(() => parseCronExpression(expression));
    for (const expression of [
      '0 0 L * *',
      '0 0 15W * *',
      '0 0 * * 5L',
      '0 0 * * MON#2',
      '0 0 ? * *',
    ])
      assert.throws(() => parseCronExpression(expression), /Quartz or Spring syntax/);
    assert.equal(parseCronExpression('0 0 * JUL WED').expression, '0 0 * JUL WED');
    assert.throws(() => parseCronExpression('x'.repeat(257)), /256/);
    assert.throws(() => parseCronExpression('* * * * *\u0000'));
  });

  it('accepts every preset ID and fails explicitly for unknown names', () => {
    assert.equal(cronPreset(), '*/15 * * * *');
    assert.equal(cronPreset('weekdays9'), '0 9 * * 1-5');
    for (const preset of [
      'every15',
      'hourly',
      'daily9',
      'weekdays9',
      'dailyMidnight',
      'weeklyMonday',
      'monthly',
    ])
      assert.equal(parseCronExpression(cronPreset(preset)).fields.length, 5);
    for (const preset of ['unknown', '', 'toString', '__proto__'])
      assert.throws(() => cronPreset(preset), /Unknown presets/);
  });
});

describe('cron explanations', () => {
  it('describes field steps without inventing continuous intervals', () => {
    const report = inspectCronExpression('*/35 * * * *');

    assert.match(report.explanation, /minutes 0, 35 of every hour/);
    assert.doesNotMatch(report.explanation, /every 35 minutes/);
    assert.match(report.warnings.join('\n'), /Steps reset/);
    assert.match(explain('*/15 * * * *'), /every 15 minutes/);
    assert.match(explain('0 9 * * 1-5'), /from 1 \(Monday\) through 5 \(Friday\)/);
  });

  it('declares day matching and only warns about impossible dates when justified', () => {
    for (const [expression, rule] of [
      ['* * * * *', 'every-day'],
      ['0 9 1 * *', 'day-of-month'],
      ['0 9 * * MON', 'day-of-week'],
      ['0 9 1 * MON', 'or'],
      ['0 9 */2 * MON', 'implementation-dependent'],
    ])
      assert.equal(inspectCronExpression(expression!).dayRule, rule);
    assert.match(inspectCronExpression('0 9 1 * MON').explanation, /1 OR Monday/);
    assert.match(inspectCronExpression('0 0 31 APR *').warnings.join('\n'), /No calendar date/);

    assert.doesNotMatch(
      inspectCronExpression('0 0 31 APR MON').warnings.join('\n'),
      /No calendar date/,
    );

    assert.doesNotMatch(
      inspectCronExpression('0 0 29 FEB *').warnings.join('\n'),
      /No calendar date/,
    );

    assert.match(inspectCronExpression('0 0 * * 0,7,SUN').explanation, /Sunday/);
    assert.throws(() => explain('0 0 * * ?'));
    assert.throws(() => explain('0 0 0 * *'), /Day of month value 0 is outside 1-31/);
  });
});

describe('next cron runs', () => {
  it('lists UTC runs after the start minute and follows the Vixie day rule', () => {
    const from = new Date('2026-10-16T09:00:00Z');

    assert.deepEqual(
      nextCronRuns(parseCronExpression('0 9 * * MON-FRI'), { count: 2, from, timeZone: 'utc' }).map(
        (run) => run.iso,
      ),
      ['2026-10-19T09:00:00.000Z', '2026-10-20T09:00:00.000Z'],
    );

    assert.deepEqual(
      nextCronRuns(parseCronExpression('0 9 1 * MON'), { count: 3, from, timeZone: 'utc' }).map(
        (run) => run.text,
      ),
      ['Mon 2026-10-19 09:00 UTC', 'Mon 2026-10-26 09:00 UTC', 'Sun 2026-11-01 09:00 UTC'],
    );

    assert.deepEqual(
      nextCronRuns(parseCronExpression('0 9 1 * *'), { count: 1, from, timeZone: 'utc' }).map(
        (run) => run.text,
      ),
      ['Sun 2026-11-01 09:00 UTC'],
    );

    assert.deepEqual(
      nextCronRuns(parseCronExpression('0 0 31 APR *'), { count: 5, from, timeZone: 'utc' }),
      [],
    );

    assert.throws(
      () => nextCronRuns(parseCronExpression('* * * * *'), { count: 0, from, timeZone: 'utc' }),
      /1 to 100/,
    );

    assert.throws(
      () =>
        nextCronRuns(parseCronExpression('* * * * *'), {
          count: 1,
          from: new Date(Number.NaN),
          timeZone: 'utc',
        }),
      /valid start/,
    );
  });

  it('skips local minutes that a daylight-saving change removes and lists repeated ones once', () => {
    const zone = process.env.TZ;

    process.env.TZ = 'Europe/Prague';

    try {
      const spring = nextCronRuns(parseCronExpression('30 2 * * *'), {
        count: 2,
        from: new Date(2027, 2, 27, 12),
        timeZone: 'local',
      });

      assert.deepEqual(
        spring.map((run) => run.text),
        ['Mon 2027-03-29 02:30 UTC+02:00', 'Tue 2027-03-30 02:30 UTC+02:00'],
      );

      const autumn = nextCronRuns(parseCronExpression('30 2 * * *'), {
        count: 2,
        from: new Date(2027, 9, 30, 12),
        timeZone: 'local',
      });

      assert.deepEqual(
        autumn.map((run) => run.text),
        ['Sun 2027-10-31 02:30 UTC+02:00', 'Mon 2027-11-01 02:30 UTC+01:00'],
      );
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });
});
