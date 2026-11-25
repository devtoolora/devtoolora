import { mathError, required } from './shared';

const maxDigits = 1_000;
const maxIntegers = 1_000;
const integerPattern = /^[+-]?\d+$/;
// Smallest strong pseudoprime to every prime base from 2 to 41.
const deterministicBound = 3_317_044_064_679_887_385_961_981n;
const deterministicBases = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
const probableBases = [...deterministicBases, 43n, 47n, 53n, 59n, 61n, 67n, 71n];

type PrimalityResult = 'composite' | 'prime' | 'probable prime';

export interface GcdLcmResult {
  gcd: bigint;
  lcm: bigint;
  text: string;
}

export interface PrimalityTest {
  result: PrimalityResult;
  text: string;
}

function parseIntegers(text: string, label: string): bigint[] {
  const tokens = required(text, label)
    .split(/[\s,;]+/)
    .filter(Boolean);

  if (tokens.length > maxIntegers) throw mathError('Input is limited to 1,000 integers.');

  return tokens.map((token, index) => {
    if (!integerPattern.test(token)) {
      throw mathError(`"${token}" at position ${index + 1} is not an integer.`);
    }

    if (token.replace(/^[+-]/, '').length > maxDigits) {
      throw mathError('Integers are limited to 1,000 digits.');
    }

    return BigInt(token);
  });
}

export function parseOneInteger(text: string): bigint {
  const [value, ...rest] = parseIntegers(text, 'Integer');

  if (value === undefined || rest.length > 0) throw mathError('Enter exactly one integer.');

  return value;
}

export function renderRows(rows: ReadonlyArray<readonly [string, string]>): string {
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;

  return rows.map(([label, value]) => `${label.padEnd(width)}${value}\n`).join('');
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function gcdOf(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);

  while (y !== 0n) [x, y] = [y, x % y];

  return x;
}

export function gcdLcm(text: string): GcdLcmResult {
  const values = parseIntegers(text, 'Integer list').map(abs);

  if (values.length < 2) throw mathError('Enter at least two integers.');

  let gcd = 0n;
  let lcm = 1n;

  for (const value of values) {
    gcd = gcdOf(gcd, value);
    lcm = lcm === 0n || value === 0n ? 0n : (lcm / gcdOf(lcm, value)) * value;
  }

  return {
    gcd,
    lcm,
    text: renderRows([
      ['GCD', String(gcd)],
      ['LCM', String(lcm)],
    ]),
  };
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let square = base % modulus;
  let rest = exponent;

  while (rest > 0n) {
    if ((rest & 1n) === 1n) result = (result * square) % modulus;

    square = (square * square) % modulus;
    rest >>= 1n;
  }

  return result;
}

function passesBase(n: bigint, base: bigint, odd: bigint, twos: number): boolean {
  let x = modPow(base, odd, n);

  if (x === 1n || x === n - 1n) return true;

  for (let i = 1; i < twos; i += 1) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
  }

  return false;
}

function millerRabin(n: bigint, bases: readonly bigint[]): boolean {
  if (n < 2n) return false;

  for (const base of bases) {
    if (n === base) return true;
    if (n % base === 0n) return false;
  }

  let odd = n - 1n;
  let twos = 0;

  while ((odd & 1n) === 0n) {
    odd >>= 1n;
    twos += 1;
  }

  return bases.every((base) => passesBase(n, base, odd, twos));
}

function isDeterministicRange(n: bigint): boolean {
  return n < deterministicBound;
}

export function isPrime(n: bigint): boolean {
  return millerRabin(n, isDeterministicRange(n) ? deterministicBases : probableBases);
}

export function testPrimality(text: string): PrimalityTest {
  const n = parseOneInteger(text);
  const deterministic = isDeterministicRange(n);
  const passes = isPrime(n);
  const verdict: PrimalityResult = deterministic ? 'prime' : 'probable prime';
  const result: PrimalityResult = passes ? verdict : 'composite';
  const method = deterministic
    ? 'deterministic Miller-Rabin, bases 2-41'
    : 'Miller-Rabin, 20 prime bases';

  return {
    result,
    text: renderRows([
      ['Result', n < 2n ? 'not prime' : result],
      ['Method', n < 2n ? 'primes are integers greater than 1' : method],
      ['Digits', String(String(abs(n)).length)],
    ]),
  };
}
