import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { describeDuration, parseDuration } from '@devtoolora/functions/datetime';

describe('duration converter', () => {
  it('parses the supported forms to milliseconds', () => {
    for (const input of ['90m', '1h 30m', '1h30m', 'PT1H30M', '01:30:00', '1:30', '1.5h']) {
      assert.equal(parseDuration(input, { unit: 's' }), 5_400_000, input);
    }

    assert.equal(parseDuration('5400', { unit: 's' }), 5_400_000);
    assert.equal(parseDuration('90', { unit: 'm' }), 5_400_000);
    assert.equal(parseDuration('P1DT2H', { unit: 's' }), 93_600_000);
    assert.equal(parseDuration('P2W', { unit: 's' }), 1_209_600_000);
    assert.equal(parseDuration('1w', { unit: 's' }), 604_800_000);
    assert.equal(parseDuration('1H 30M 15S 250MS', { unit: 's' }), 5_415_250);
    assert.equal(parseDuration('01:30:00.250', { unit: 's' }), 5_400_250);
    assert.equal(parseDuration('250', { unit: 'ms' }), 250);
    assert.equal(parseDuration('1m5s', { unit: 's' }), 65_000);
    assert.equal(parseDuration('5ms', { unit: 's' }), 5);
    assert.equal(parseDuration('1.1h', { unit: 's' }), 3_960_000);
    assert.equal(parseDuration('pt1h30m', { unit: 's' }), 5_400_000);
    assert.equal(parseDuration('PT0.5S', { unit: 's' }), 500);
    assert.equal(parseDuration('PT0S', { unit: 's' }), 0);
  });

  it('describes a duration', () => {
    assert.deepEqual(describeDuration(5_400_000), {
      clock: '01:30:00',
      human: '1 h 30 min',
      iso: 'PT1H30M',
      milliseconds: 5_400_000,
      totals: { days: 0.0625, hours: 1.5, minutes: 90, seconds: 5400 },
    });

    assert.equal(describeDuration(250).human, '250 ms');
    assert.equal(describeDuration(250).iso, 'PT0.25S');
    assert.equal(describeDuration(250).clock, '00:00:00.250');
    assert.equal(describeDuration(93_600_000).iso, 'P1DT2H');
    assert.equal(describeDuration(183_600_000).human, '2 d 3 h');
    assert.equal(describeDuration(90_000_000).clock, '25:00:00');
    assert.equal(describeDuration(0).human, '0 s');
    assert.equal(describeDuration(0).iso, 'PT0S');
  });

  it('rejects invalid input', () => {
    const generic = /Enter a duration such as 90m/;

    for (const input of [
      '',
      '  ',
      '-5s',
      'soon',
      '1:75',
      '1h 2h',
      'P',
      'PT',
      'P1DT',
      'p1dt',
      'P1Y',
      'P1M',
    ]) {
      assert.throws(() => parseDuration(input, { unit: 's' }), generic, input);
    }

    assert.throws(() => parseDuration('P2000Y', { unit: 's' }), /1,000 years/);
    assert.throws(() => parseDuration('400000d', { unit: 's' }), /1,000 years/);
    assert.equal(parseDuration('365250d', { unit: 's' }), 365_250 * 86_400_000);
  });
});
