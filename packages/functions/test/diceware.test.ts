import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { dicewareFromRolls, effWordForRoll, effWords, generateDiceware } from '../src/crypto';

const base = { capitalize: false, digit: false, separator: 'space' as const };

describe('Diceware', () => {
  it('ships the EFF long list in roll order', () => {
    assert.equal(effWords.length, 7776);
    assert.equal(new Set(effWords).size, 7776);
    assert.equal(effWordForRoll('11111'), 'abacus');
    assert.equal(effWordForRoll('66666'), 'zoom');
    assert.equal(effWordForRoll('11112'), effWords[1]);
    assert.equal(effWordForRoll('11121'), effWords[6]);
  });

  it('builds passphrases from rolls and reports entropy', () => {
    assert.deepEqual(dicewareFromRolls('11111\n66666', base), {
      bits: 25.8,
      passphrases: ['abacus zoom'],
    });

    assert.deepEqual(
      dicewareFromRolls('11111\n66666\n', { ...base, capitalize: true, separator: 'dash' })
        .passphrases,
      ['Abacus-Zoom'],
    );

    assert.deepEqual(dicewareFromRolls('11111 66666', base).passphrases, ['abacus zoom']);

    assert.throws(
      () => dicewareFromRolls('11111\n12347', base),
      /Line 2 "12347" is not five dice digits 1-6\./,
    );

    assert.throws(() => dicewareFromRolls('', base), /Enter at least one dice roll\./);
  });

  it('generates random passphrases with the requested shape', () => {
    const { bits, passphrases } = generateDiceware({ ...base, count: 3, words: 6 });

    assert.equal(passphrases.length, 3);
    assert.equal(bits, 77.5);

    assert.ok(
      passphrases.every(
        (p) => p.split(' ').length === 6 && p.split(' ').every((w) => effWords.includes(w)),
      ),
    );

    const digit = generateDiceware({ ...base, count: 1, digit: true, separator: 'none', words: 2 });

    assert.match(digit.passphrases[0] ?? '', /^[a-z]+\d[a-z]*$/);
    assert.equal(digit.bits, 29.2);

    assert.equal(
      generateDiceware({
        ...base,
        count: 1,
        separator: 'underscore',
        words: 2,
      }).passphrases[0]?.split('_').length,
      2,
    );
  });

  it('enforces its limits', () => {
    assert.throws(
      () => generateDiceware({ ...base, count: 1, words: 21 }),
      /Words must be an integer between 1 and 20\./,
    );

    assert.throws(
      () => generateDiceware({ ...base, count: 21, words: 6 }),
      /Count must be an integer between 1 and 20\./,
    );

    assert.throws(
      () => dicewareFromRolls(Array.from({ length: 1001 }, () => '11111').join('\n'), base),
      /Dice rolls exceed 1,000 lines\./,
    );
  });
});
