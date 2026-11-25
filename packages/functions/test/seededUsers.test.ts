import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateSeededUsers } from '@devtoolora/functions/data';
import { FunctionError } from '@devtoolora/functions/errors';

describe('seeded synthetic users', () => {
  it('is repeatable, prefix-stable and independent of previous calls', () => {
    const users = generateSeededUsers(42, 5);

    generateSeededUsers(0xffffffff, 1000);
    assert.deepEqual(generateSeededUsers(42, 5), users);
    assert.deepEqual(generateSeededUsers(42, 10).slice(0, 5), users);
    assert.notDeepEqual(generateSeededUsers(43, 5), users);

    assert.deepEqual(users[0], {
      active: true,
      email: 'linus.lovelace.1@example.test',
      id: 1,
      name: 'Linus Lovelace',
    });

    assert.deepEqual(generateSeededUsers(), generateSeededUsers(42, 10));
  });

  it('produces unique batch emails and IDs with typed flags at both seed boundaries', () => {
    for (const seed of [0, 42, 0xffffffff]) {
      const users = generateSeededUsers(seed, 1000);

      assert.equal(users.length, 1000);
      assert.equal(new Set(users.map((user) => user.email)).size, 1000);
      assert.equal(new Set(users.map((user) => user.id)).size, 1000);
      assert.ok(new Set(users.map((user) => user.name)).size <= 36);

      users.forEach((user, index) => {
        assert.equal(user.id, index + 1);
        assert.equal(typeof user.active, 'boolean');
        assert.match(user.email, /^[a-z]+\.[a-z]+\.\d+@example\.test$/);
      });
    }

    assert.equal(generateSeededUsers(0, 1).length, 1);
  });

  it('rejects invalid seeds and counts without wrapping, rounding or clamping', () => {
    for (const seed of [-1, 0x100000000, 1.5, NaN, Infinity, -Infinity]) {
      assert.throws(
        () => generateSeededUsers(seed),
        (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_SEED',
      );
    }

    for (const count of [0, -1, 1001, 1.5, NaN, Infinity, -Infinity]) {
      assert.throws(
        () => generateSeededUsers(42, count),
        (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_COUNT',
      );
    }
  });
});
