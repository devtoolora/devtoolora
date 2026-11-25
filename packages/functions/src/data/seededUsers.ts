import { FunctionError } from '../errors';

export interface SeededUser {
  active: boolean;
  email: string;
  id: number;
  name: string;
}

/** Deterministic fixture data, not cryptographic randomness or real identities. */
export function generateSeededUsers(seed = 42, count = 10): SeededUser[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new FunctionError('INVALID_SEED', 'Seed must be an integer from 0 through 4294967295.');
  }

  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new FunctionError('INVALID_COUNT', 'Count must be an integer from 1 through 1000.');
  }

  let state = seed;

  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 0x100000000;
  };

  const firstNames = ['Ada', 'Linus', 'Grace', 'Margaret', 'Alan', 'Mina'];
  const lastNames = ['Lovelace', 'Torvalds', 'Hopper', 'Hamilton', 'Turing', 'Khan'];

  return Array.from({ length: count }, (_, index): SeededUser => {
    const name = `${firstNames[Math.floor(next() * firstNames.length)]} ${lastNames[Math.floor(next() * lastNames.length)]}`;
    const id = index + 1;

    return {
      active: next() > 0.35,
      email: `${name.toLowerCase().replace(' ', '.')}.${id}@example.test`,
      id,
      name,
    };
  });
}
