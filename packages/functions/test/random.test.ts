import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { randomBelow, randomDecimals, randomIntegers, rollDice } from '../src/math/random';

const integers = (options: Partial<Parameters<typeof randomIntegers>[0]>) =>
  randomIntegers({ count: 1, max: '9', min: '0', sorted: false, unique: false, ...options });

describe('random numbers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws unique sorted integers', () => {
    assert.deepEqual(
      integers({ count: 10, max: '10', min: '1', sorted: true, unique: true }),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );

    assert.equal(new Set(integers({ count: 500, max: '100000', unique: true })).size, 500);
  });

  it('keeps integers inside the range', () => {
    for (const n of integers({ count: 1000, max: '3', min: '-3' })) {
      assert.ok(Number.isInteger(n) && n >= -3 && n <= 3);
    }
  });

  it('rejects invalid integer options', () => {
    assert.throws(() => integers({ count: 11, max: '10', min: '1', unique: true }), /10 distinct/);
    assert.throws(() => integers({ max: '1', min: '2' }), /Min must not exceed max/);
    assert.throws(() => integers({ max: '9007199254740992' }), /2\^53 - 1/);
    assert.throws(() => integers({ count: 10_001 }), /1-10,000/);
    assert.throws(() => integers({ min: 'abc' }), /whole number/);
  });

  it('formats decimals with a fixed number of places', () => {
    for (const value of randomDecimals({ count: 200, max: '1', min: '0', places: 2 })) {
      assert.match(value, /^(0\.\d\d|1\.00)$/);
    }

    assert.match(randomDecimals({ count: 1, max: '5', min: '-5', places: 0 })[0] ?? '', /^-?\d+$/);
    assert.throws(() => randomDecimals({ count: 1, max: '1', min: '0', places: 16 }), /0-15/);
    assert.throws(() => randomDecimals({ count: 1, max: '0', min: '1', places: 2 }), /Min must/);
  });

  it('rolls dice', () => {
    const big = rollDice('100d1000', 5);

    for (const roll of big.rolls) {
      assert.ok(roll.total >= 100 && roll.total <= 100_000 && roll.dice.length === 100);
    }

    assert.equal(rollDice('2d6+3', 1).rolls[0]?.dice.length, 2);
    assert.match(rollDice('2D6-1', 2).text, /^(2d6-1: \[\d, \d\] - 1 = \d+\n){2}$/);
    assert.match(rollDice('2d6+3', 1).text, /^2d6\+3: \[\d, \d\] \+ 3 = \d+\n$/);
    assert.match(rollDice('1d6', 1).text, /^1d6: \[\d\] = \d\n$/);
  });

  it('rejects invalid dice', () => {
    assert.throws(() => rollDice('1d6+1000001', 1), /1,000,000/);
    assert.throws(() => rollDice('0d6', 1), /1-100 dice/);
    assert.throws(() => rollDice('2d1', 1), /2-1,000 sides/);
    assert.throws(() => rollDice('d6', 1), /NdM/);
    assert.throws(() => rollDice('2x6', 1), /NdM/);
    assert.throws(() => rollDice('2d6', 1001), /1-1,000 rolls/);
  });

  it('rejects the biased tail in randomBelow', () => {
    const values = [255, 1];
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint8Array) => {
      array.fill(values.shift() ?? 0);

      return array;
    }) as typeof crypto.getRandomValues);

    assert.equal(randomBelow(200n), 1n);
    assert.equal(spy.mock.calls.length, 2);
    assert.throws(() => randomBelow(0n));
  });
});
