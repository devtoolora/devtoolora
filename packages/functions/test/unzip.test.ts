import { Zip, ZipDeflate, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readZip } from '../src/binary/unzip';

const mib = 1_048_576;
const all = { include: () => true };

function codeOf(run: () => unknown): { code?: string; message?: string } {
  try {
    run();
  } catch (error) {
    return error as { code?: string; message?: string };
  }

  return {};
}

function patchSizes(zip: Uint8Array, value: number): Uint8Array {
  const copy = zip.slice();
  const view = new DataView(copy.buffer);

  for (let index = 0; index < copy.length - 4; index += 1) {
    if (view.getUint32(index, true) === 0x04034b50) view.setUint32(index + 22, value, true);
    if (view.getUint32(index, true) === 0x02014b50) view.setUint32(index + 24, value, true);
  }

  return copy;
}

describe('readZip', () => {
  it('round trips and filters', () => {
    const zip = zipSync({ 'a.txt': new Uint8Array([1, 2]), 'b.txt': new Uint8Array([3]) });
    const both = readZip(zip, all);

    expect([...both.keys()]).toEqual(['a.txt', 'b.txt']);
    expect(both.get('a.txt')).toEqual(new Uint8Array([1, 2]));
    expect([...readZip(zip, { include: (name) => name === 'b.txt' }).keys()]).toEqual(['b.txt']);
  });

  it('limits entry count', () => {
    const files: Record<string, Uint8Array> = {};

    for (let index = 0; index < 2_001; index += 1) files[`f${index}`] = new Uint8Array(0);

    const error = codeOf(() => readZip(zipSync(files), all));

    expect(error.code).toBe('ZIP_LIMIT');
    expect(error.message).toContain('2,000 entries');
  });

  it('limits entry and total inflated size, counting skipped entries', () => {
    const big = codeOf(() => readZip(zipSync({ z: new Uint8Array(51 * mib) }), all));

    expect(big.code).toBe('ZIP_LIMIT');
    expect(big.message).toContain('50 MiB');

    const zip = zipSync({
      a: new Uint8Array(40 * mib),
      b: new Uint8Array(40 * mib),
      c: new Uint8Array(40 * mib),
    });
    const total = codeOf(() => readZip(zip, { include: (name) => name === 'a' }));

    expect(total.code).toBe('ZIP_LIMIT');
    expect(total.message).toContain('100 MiB');
  });

  it('counts inflated bytes when headers lie', () => {
    const zip = patchSizes(zipSync({ z: new Uint8Array(60 * mib) }), 10);

    expect(codeOf(() => readZip(zip, all)).code).toBe('ZIP_LIMIT');
  });

  it('rejects non-zips and encrypted entries', () => {
    expect(codeOf(() => readZip(new Uint8Array([1, 2, 3]), all)).code).toBe('INVALID_ZIP');

    const zip = zipSync({ a: new Uint8Array([1]) });
    const view = new DataView(zip.buffer);

    for (let index = 0; index < zip.length - 4; index += 1) {
      if (view.getUint32(index, true) === 0x02014b50) view.setUint16(index + 8, 1, true);
    }

    expect(codeOf(() => readZip(zip, all)).code).toBe('UNSUPPORTED_ZIP');
  });

  it('limits data-descriptor bombs', () => {
    const parts: Uint8Array[] = [];
    const zip = new Zip((error, chunk) => {
      if (!error) parts.push(chunk);
    });
    const file = new ZipDeflate('z', { level: 9 });

    zip.add(file);
    file.push(new Uint8Array(60 * mib), true);
    zip.end();

    const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;

    for (const part of parts) {
      joined.set(part, at);
      at += part.length;
    }

    expect(codeOf(() => readZip(joined, all)).code).toBe('ZIP_LIMIT');
  });

  it('rejects duplicate names and unsupported methods', () => {
    const one = zipSync({ aa: new Uint8Array([1]) });
    const two = zipSync({ ab: new Uint8Array([1]) });
    const dup = new Uint8Array(one.length + two.length);

    // Concatenated archives expose two local headers; rename the second to match the first.
    dup.set(one);
    dup.set(two, one.length);
    new DataView(dup.buffer).setUint8(one.length + 31, 'a'.charCodeAt(0));
    new DataView(dup.buffer).setUint8(one.length + 30, 'a'.charCodeAt(0));
    expect(codeOf(() => readZip(dup, all)).code).toBe('UNSUPPORTED_ZIP');

    const method = zipSync({ a: new Uint8Array([1]) });
    const view = new DataView(method.buffer);

    for (let index = 0; index < method.length - 4; index += 1) {
      if (view.getUint32(index, true) === 0x04034b50) view.setUint16(index + 8, 12, true);
    }

    expect(codeOf(() => readZip(method, all)).code).toBe('UNSUPPORTED_ZIP');
  });

  it('rethrows caller errors untouched', () => {
    const zip = zipSync({ a: new Uint8Array([1]) });

    expect(
      codeOf(() =>
        readZip(zip, {
          include: () => {
            throw new Error('boom');
          },
        }),
      ).message,
    ).toBe('boom');
  });
});
