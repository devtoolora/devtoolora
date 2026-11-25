import { gcdOf, isPrime, parseOneInteger, renderRows } from './numberTheory';
import { mathError } from './shared';

const maxValue = 2n ** 64n - 1n;
const trialLimit = 10_000n;
const iterationBudget = 10_000_000;
const gcdBatch = 128;

type PrimeFactors = Array<[bigint, number]>;

export interface Factorization {
  factors: PrimeFactors;
  text: string;
}

interface Budget {
  left: number;
}

function spend(budget: Budget, steps: number): void {
  budget.left -= steps;

  if (budget.left < 0) throw mathError('Factorization stopped after 10,000,000 iterations.');
}

function distance(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a;
}

// Brent's cycle detection with batched gcd; backtracks one step at a time when a batch overshoots.
function pollardBrent(n: bigint, c: bigint, budget: Budget): bigint {
  const next = (value: bigint): bigint => (value * value + c) % n;
  let y = 2n;
  let x = y;
  let saved = y;
  let product = 1n;
  let divisor = 1n;

  for (let length = 1; divisor === 1n; length *= 2) {
    x = y;
    for (let i = 0; i < length; i += 1) y = next(y);
    spend(budget, length);

    for (let done = 0; done < length && divisor === 1n; done += gcdBatch) {
      saved = y;
      const steps = Math.min(gcdBatch, length - done);

      for (let i = 0; i < steps; i += 1) {
        y = next(y);
        product = (product * distance(x, y)) % n;
      }

      spend(budget, steps);
      divisor = gcdOf(product, n);
    }
  }

  if (divisor === n) {
    do {
      saved = next(saved);
      spend(budget, 1);
      divisor = gcdOf(distance(x, saved), n);
    } while (divisor === 1n);
  }

  return divisor;
}

function splitLarge(n: bigint, found: bigint[], budget: Budget): void {
  if (n === 1n) return;

  if (isPrime(n)) {
    found.push(n);

    return;
  }

  for (let c = 1n; ; c += 1n) {
    const divisor = pollardBrent(n, c, budget);

    if (divisor !== n) {
      splitLarge(divisor, found, budget);
      splitLarge(n / divisor, found, budget);

      return;
    }
  }
}

function primeFactors(value: bigint): bigint[] {
  const found: bigint[] = [];
  let n = value;

  for (let p = 2n; p <= trialLimit && p * p <= n; p += p === 2n ? 1n : 2n) {
    while (n % p === 0n) {
      found.push(p);
      n /= p;
    }
  }

  if (n > 1n && n < trialLimit * trialLimit) found.push(n);
  else splitLarge(n, found, { left: iterationBudget });

  return found.sort((a, b) => Number(a > b) - Number(a < b));
}

function groupFactors(primes: readonly bigint[]): PrimeFactors {
  const factors: PrimeFactors = [];

  for (const prime of primes) {
    const last = factors[factors.length - 1];

    if (last?.[0] === prime) last[1] += 1;
    else factors.push([prime, 1]);
  }

  return factors;
}

function divisorRows(factors: PrimeFactors): Array<[string, string]> {
  let count = 1n;
  let sum = 1n;
  let totient = 1n;

  for (const [prime, exponent] of factors) {
    const power = prime ** BigInt(exponent);

    count *= BigInt(exponent + 1);
    sum *= (power * prime - 1n) / (prime - 1n);
    totient *= (power / prime) * (prime - 1n);
  }

  return [
    ['Divisors', String(count)],
    ['Sum of divisors', String(sum)],
    ["Euler's totient", String(totient)],
  ];
}

export function factorize(text: string): Factorization {
  const n = parseOneInteger(text);

  if (n < 2n || n > maxValue) throw mathError('Enter an integer from 2 to 2^64 - 1.');

  const factors = groupFactors(primeFactors(n));
  const product = factors
    .map(([prime, exponent]) => (exponent === 1 ? String(prime) : `${prime}^${exponent}`))
    .join(' × ');

  return {
    factors,
    text: renderRows([['Factorization', product], ...divisorRows(factors)]),
  };
}
