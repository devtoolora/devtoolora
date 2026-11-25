import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { addToDate, dateDifference, dateInfo, todayDate } from '@devtoolora/functions/datetime';

describe('date calculator', () => {
  it('computes differences', () => {
    const diff = dateDifference('2024-01-01', '2024-03-01');

    assert.equal(diff.days, 60);
    assert.deepEqual(diff.weeks, { days: 4, weeks: 8 });
    assert.equal(diff.businessDays, 44);
    assert.equal(diff.yearsMonthsDays, '2 months');
    assert.equal(dateDifference('2024-01-31', '2024-03-01').yearsMonthsDays, '1 month, 1 day');
    assert.equal(dateDifference('2026-10-19', '2026-10-26').businessDays, 5);
    assert.equal(dateDifference('2024-03-01', '2024-01-01').days, -60);
    assert.equal(dateDifference('2024-03-01', '2024-01-01').businessDays, -44);
    assert.equal(dateDifference('2024-03-01', '2024-03-01').yearsMonthsDays, '0 days');
    assert.equal(dateDifference('2024-03-01', '2024-01-31').yearsMonthsDays, '-1 month, 1 day');

    assert.equal(
      dateDifference('2020-02-29', '2026-10-20').yearsMonthsDays,
      '6 years, 7 months, 21 days',
    );
  });

  it('adds and subtracts amounts', () => {
    assert.equal(addToDate('2024-01-31', '+1m'), '2024-02-29');
    assert.equal(addToDate('2024-02-29', '+1y'), '2025-02-28');
    assert.equal(addToDate('2026-10-23', '+1bd'), '2026-10-26');
    assert.equal(addToDate('2026-10-26', '-1bd'), '2026-10-23');
    assert.equal(addToDate('2026-10-24', '+1bd'), '2026-10-26');
    assert.equal(addToDate('2026-10-24', '-1bd'), '2026-10-23');
    assert.equal(addToDate('2026-10-24', '+5bd'), '2026-10-30');
    assert.equal(addToDate('2026-10-20', '+1y 2m 3w 4d'), '2028-01-14');

    assert.throws(() => addToDate('2026-10-20', '+1bd 2d'), {
      message: /Business days cannot be combined/,
    });

    assert.throws(() => addToDate('9999-12-31', '+1d'), { message: /0001 to 9999/ });
    assert.throws(() => addToDate('2026-01-01', '+100001d'), { message: /100,000/ });

    assert.throws(() => addToDate('2026-01-01', '+100000y 100000y 100000y'), {
      message: /100,000/,
    });

    assert.throws(() => addToDate('2026-01-01', '+100000y'), { message: /0001 to 9999/ });
    assert.throws(() => addToDate('0001-01-01', '-1d'), { message: /0001 to 9999/ });
    assert.throws(() => addToDate('2026-01-01', 'soon'), { message: /Amount/ });
  });

  it('describes a date', () => {
    assert.deepEqual(dateInfo('2027-01-01'), {
      dayOfYear: 1,
      daysInMonth: 31,
      isoWeek: '2026-W53-5',
      leapYear: false,
      quarter: 1,
      weekday: 'Friday',
    });

    assert.equal(dateInfo('2024-12-30').isoWeek, '2025-W01-1');

    assert.throws(() => dateInfo('2026-02-30'), {
      message: /2026-02-30 is not a valid calendar date\./,
    });

    assert.equal(todayDate(new Date(2026, 9, 5)), '2026-10-05');
  });

  it('treats zero business days as no movement and still rejects mixing', () => {
    assert.throws(() => addToDate('2026-10-21', '+0bd 1m'), /cannot be combined/);
    assert.equal(addToDate('2026-10-24', '+0bd'), '2026-10-24');
    assert.equal(addToDate('2026-10-25', '-0bd'), '2026-10-25');
    assert.equal(addToDate('2026-10-21', '+0bd'), '2026-10-21');
  });
});
