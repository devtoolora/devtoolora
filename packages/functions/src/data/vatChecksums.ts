type Check = (body: string) => boolean | undefined;

const digitsOf = (text: string): number[] => [...text].map(Number);

const weighted = (digits: number[], weights: number[]): number =>
  weights.reduce((total, weight, index) => total + weight * (digits[index] ?? 0), 0);

const descending = (from: number, to: number): number[] =>
  Array.from({ length: from - to + 1 }, (_, index) => from - index);

const digitSum = (value: number): number => (value > 9 ? value - 9 : value);

function luhn(text: string): boolean {
  const total = digitsOf(text)
    .reverse()
    .reduce((sum, digit, index) => sum + (index % 2 === 1 ? digitSum(digit * 2) : digit), 0);

  return total % 10 === 0;
}

function mod1110(body: string): boolean {
  const product = digitsOf(body.slice(0, -1)).reduce((running, digit) => {
    const sum = (digit + running) % 10 || 10;

    return (2 * sum) % 11;
  }, 10);

  return (11 - product) % 10 === Number(body.slice(-1));
}

function mod11Check(body: string, weights: number[]): boolean {
  const remainder = 11 - (weighted(digitsOf(body), weights) % 11);

  return remainder !== 10 && (remainder === 11 ? 0 : remainder) === Number(body[weights.length]);
}

function austria(body: string): boolean {
  const d = digitsOf(body.slice(1));
  const doubled = (index: number) => digitSum((d[index] ?? 0) * 2);
  const sum =
    (d[0] ?? 0) + doubled(1) + (d[2] ?? 0) + doubled(3) + (d[4] ?? 0) + doubled(5) + (d[6] ?? 0);

  return (96 - sum) % 10 === d[7];
}

function belgium(body: string): boolean {
  return 97 - (Number(body.slice(0, 8)) % 97) === Number(body.slice(8));
}

function switzerland(body: string): boolean {
  return mod11Check(body.slice(1, 10), [5, 4, 3, 2, 7, 6, 5, 4]);
}

function czechia(body: string): boolean | undefined {
  if (body.length !== 8) return undefined;

  const sum = weighted(digitsOf(body), descending(8, 2));

  return (11 - (sum % 11)) % 10 === Number(body[7]);
}

const denmark = (body: string): boolean =>
  weighted(digitsOf(body), [2, 7, 6, 5, 4, 3, 2, 1]) % 11 === 0;

const estonia = (body: string): boolean =>
  weighted(digitsOf(body), [3, 7, 1, 3, 7, 1, 3, 7, 1]) % 10 === 0;

function finland(body: string): boolean {
  const remainder = weighted(digitsOf(body), [7, 9, 10, 5, 8, 4, 2]) % 11;

  if (remainder === 1) return false;

  return (remainder === 0 ? 0 : 11 - remainder) === Number(body[7]);
}

function france(body: string): boolean | undefined {
  if (!/^\d\d/.test(body)) return undefined;

  return (12 + 3 * (Number(body.slice(2)) % 97)) % 97 === Number(body.slice(0, 2));
}

function britain(body: string): boolean | undefined {
  if (!/^\d/.test(body)) return undefined;

  const first = body.slice(0, 9);
  const sum = weighted(digitsOf(first), descending(8, 2)) + Number(first.slice(7));

  return sum % 97 === 0 || (sum + 55) % 97 === 0;
}

function hungary(body: string): boolean {
  const sum = weighted(digitsOf(body), [9, 7, 3, 1, 9, 7, 3]);

  return (10 - (sum % 10)) % 10 === Number(body[7]);
}

function ireland(body: string): boolean | undefined {
  if (!/^\d{7}[A-W][A-IW]?$/.test(body)) return undefined;

  const letters = 'WABCDEFGHIJKLMNOPQRSTUV';
  const second = body[8] === undefined ? 0 : 9 * 'WABCDEFGHI'.indexOf(body[8]);
  const sum = weighted(digitsOf(body.slice(0, 7)), descending(8, 2)) + second;

  return letters[sum % 23] === body[7];
}

const luxembourg = (body: string): boolean =>
  Number(body.slice(0, 6)) % 89 === Number(body.slice(6));

function netherlands(body: string): boolean {
  if (weighted(digitsOf(body.slice(0, 8)), descending(9, 2)) % 11 === Number(body[8])) return true;

  const numeric = [...`NL${body}`]
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join('');

  return BigInt(numeric) % 97n === 1n;
}

const norway = (body: string): boolean => mod11Check(body.slice(0, 9), [3, 2, 7, 6, 5, 4, 3, 2]);

const poland = (body: string): boolean =>
  weighted(digitsOf(body), [6, 5, 7, 2, 3, 4, 5, 6, 7]) % 11 === Number(body[9]);

function portugal(body: string): boolean {
  const remainder = 11 - (weighted(digitsOf(body), descending(9, 2)) % 11);

  return (remainder >= 10 ? 0 : remainder) === Number(body[8]);
}

function slovenia(body: string): boolean {
  const remainder = 11 - (weighted(digitsOf(body), descending(8, 2)) % 11);

  return remainder !== 11 && (remainder === 10 ? 0 : remainder) === Number(body[7]);
}

const checks = new Map<string, Check>([
  ['AT', austria],
  ['BE', belgium],
  ['CH', switzerland],
  ['CZ', czechia],
  ['DE', mod1110],
  ['DK', denmark],
  ['EE', estonia],
  ['FI', finland],
  ['FR', france],
  ['GB', britain],
  ['HR', mod1110],
  ['HU', hungary],
  ['IE', ireland],
  ['IT', luhn],
  ['LU', luxembourg],
  ['NL', netherlands],
  ['NO', norway],
  ['PL', poland],
  ['PT', portugal],
  ['SE', (body) => body.endsWith('01') && luhn(body.slice(0, 10))],
  ['SI', slovenia],
  ['SK', (body) => Number(body) % 11 === 0],
]);

export function checksumVat(country: string, body: string): 'fail' | 'not checked' | 'pass' {
  const result = checks.get(country)?.(body);

  if (result === undefined) return 'not checked';

  return result ? 'pass' : 'fail';
}
