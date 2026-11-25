import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { factorize, gcdLcm, testPrimality } from '@devtoolora/functions/math';

describe('gcdLcm', () => {
  it('computes the gcd and lcm of a list', () => {
    assert.deepEqual([gcdLcm('84, 126, 210').gcd, gcdLcm('84 126 210').lcm], [42n, 1260n]);
    assert.equal(gcdLcm('0 5').lcm, 0n);
    assert.equal(gcdLcm('-12 18').gcd, 6n);
    assert.equal(gcdLcm('84;126\n210').text, 'GCD  42\nLCM  1260\n');
  });

  it('rejects invalid lists', () => {
    assert.throws(() => gcdLcm('12'), /at least two/);
    assert.throws(() => gcdLcm('12 1.5'), /"1\.5" at position 2/);
    assert.throws(() => gcdLcm(''), /required/);
    assert.throws(() => gcdLcm('1 '.repeat(1001)), /1,000 integers/);
    assert.throws(() => gcdLcm(`1 ${'9'.repeat(1001)}`), /1,000 digits/);
  });
});

describe('testPrimality', () => {
  it('classifies integers', () => {
    assert.equal(testPrimality('18446744073709551557').result, 'prime');
    assert.equal(testPrimality('561').result, 'composite');
    assert.equal(testPrimality('3317044064679887385961981').result, 'composite');
    assert.equal(testPrimality(String(2n ** 127n - 1n)).result, 'probable prime');
    assert.equal(testPrimality('1').result, 'composite');
    assert.equal(testPrimality('0').result, 'composite');
    assert.equal(testPrimality('-7').result, 'composite');
    assert.equal(testPrimality('2').result, 'prime');
  });

  it('prints result, method and digits', () => {
    assert.equal(
      testPrimality('97').text,
      'Result  prime\nMethod  deterministic Miller-Rabin, bases 2-41\nDigits  2\n',
    );

    assert.match(testPrimality('1').text, /^Result +not prime$/m);

    assert.match(
      testPrimality(String(2n ** 127n - 1n)).text,
      /^Method +Miller-Rabin, 20 prime bases$/m,
    );
  });

  it('rejects invalid input', () => {
    assert.throws(() => testPrimality('9'.repeat(1001)), /1,000 digits/);
    assert.throws(() => testPrimality('12 13'), /one integer/);
    assert.throws(() => testPrimality('x'), /"x" at position 1/);
  });
});

describe('factorize', () => {
  it('factors small and 64-bit integers', () => {
    assert.deepEqual(factorize('360').factors, [
      [2n, 3],
      [3n, 2],
      [5n, 1],
    ]);

    assert.deepEqual(
      factorize(String(2n ** 64n - 1n)).factors.map(([p]) => p),
      [3n, 5n, 17n, 257n, 641n, 65537n, 6700417n],
    );

    assert.deepEqual(factorize('18446743979220271189').factors, [
      [4294967279n, 1],
      [4294967291n, 1],
    ]);

    assert.deepEqual(factorize('18446744030759878681').factors, [[4294967291n, 2]]);
  });

  it('prints the factorization and divisor functions', () => {
    const { text } = factorize('360');

    assert.match(text, /^Factorization +2\^3 × 3\^2 × 5$/m);
    assert.match(text, /^Divisors +24$/m);
    assert.match(text, /^Sum of divisors +1170$/m);
    assert.match(text, /^Euler's totient +96$/m);
    assert.ok(text.endsWith('\n'));
    assert.match(factorize('97').text, /^Factorization +97$/m);
    assert.match(factorize('97').text, /^Divisors +2$/m);
  });

  it('rejects out-of-range input', () => {
    assert.throws(() => factorize(String(2n ** 64n)), /2\^64 - 1/);
    assert.throws(() => factorize('1'), /from 2/);
    assert.throws(() => factorize('-5'), /from 2/);
  });

  it('runs the heavy vectors quickly', () => {
    for (const run of [
      () => factorize(String(2n ** 64n - 1n)),
      () => factorize('18446743979220271189'),
      () => testPrimality(String(2n ** 127n - 1n)),
    ]) {
      const start = performance.now();

      run();
      assert.ok(performance.now() - start < 1000);
    }
  });
});
