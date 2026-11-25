import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateRandomPorts } from '../src/dev';

describe('random port candidates', () => {
  it('generates distinct integers within inclusive bounds, including a complete small range', () => {
    const ports = generateRandomPorts(1000, 49152, 65535);

    assert.equal(ports.length, 1000);
    assert.equal(new Set(ports).size, 1000);
    assert.ok(ports.every((port) => Number.isInteger(port) && port >= 49152 && port <= 65535));

    assert.deepEqual(
      generateRandomPorts(3, 3000, 3002).sort((a, b) => a - b),
      [3000, 3001, 3002],
    );

    assert.deepEqual(generateRandomPorts(1, 65535, 65535), [65535]);
    assert.deepEqual(generateRandomPorts(1, 1, 1), [1]);
  });

  it('rejects fractions, nonfinite values, bad ranges and impossible distinct counts', () => {
    for (const count of [0, -1, 1.5, 1001, NaN, Infinity])
      assert.throws(() => generateRandomPorts(count, 3000, 9999), /Count/);

    for (const port of [0, -1, 1.5, 65536, NaN, Infinity]) {
      assert.throws(() => generateRandomPorts(1, port, 65535), /ports must be integers/);
      assert.throws(() => generateRandomPorts(1, 1, port), /ports must be integers/);
    }

    assert.throws(() => generateRandomPorts(1, 3002, 3000), /Min port must not exceed/);
    assert.throws(() => generateRandomPorts(4, 3000, 3002), /3 distinct ports/);
  });

  it('rejects biased overflow draws, samples without replacement and fails closed for missing crypto', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    let calls = 0;

    try {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {
          getRandomValues: (bytes: Uint8Array): Uint8Array => {
            assert.equal(bytes.length, 4);
            calls += 1;
            bytes.fill(calls === 1 ? 255 : 0);

            return bytes;
          },
        },
      });

      assert.deepEqual(generateRandomPorts(3, 3000, 3002), [3000, 3002, 3001]);
      assert.equal(calls, 3);
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
      assert.throws(() => generateRandomPorts(1, 3000, 3002), /random values are unavailable/);
      assert.deepEqual(generateRandomPorts(1, 3000, 3000), [3000]);

      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {
          getRandomValues: (bytes: Uint8Array): Uint8Array => {
            bytes.fill(255);

            return bytes;
          },
        },
      });

      assert.throws(() => generateRandomPorts(1, 3000, 3002), /No partial port list/);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });
});
