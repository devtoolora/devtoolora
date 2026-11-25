import { randomBytes } from '../crypto/primitives';
import { devError } from './shared';

export function generateRandomPorts(count: number, min: number, max: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 1000)
    throw devError('Count must be an integer from 1 through 1,000.');
  if (![min, max].every((port) => Number.isInteger(port) && port >= 1 && port <= 65535))
    throw devError('Min and max ports must be integers from 1 through 65,535.');
  if (min > max) throw devError('Min port must not exceed max port.');

  const size = max - min + 1;

  if (count > size)
    throw devError(`Count exceeds the ${size} distinct ports in the inclusive range.`);

  const pool = Array.from({ length: size }, (_, index) => min + index);
  const ports: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const remaining = size - index;
    const offset = randomPortOffset(remaining);

    const port = pool[offset];
    const last = pool[remaining - 1];

    if (port === undefined || last === undefined)
      throw new Error('Port pool index is out of range.');

    ports.push(port);
    pool[offset] = last;
  }

  return ports;
}

function randomPortOffset(size: number): number {
  if (size === 1) return 0;

  const limit = Math.floor(4294967296 / size) * size;

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const bytes = randomBytes(4);
    const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);

    if (value < limit) return value % size;
  }

  throw devError(
    'The random source did not produce an accepted draw. No partial port list is returned.',
  );
}
