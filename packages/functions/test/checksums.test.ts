import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { checksumAlgorithms, checksumLabel, computeChecksum } from '../src/crypto';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('checksums', () => {
  it('matches the reference values', () => {
    const check = Object.fromEntries(
      checksumAlgorithms.map((a) => [a, computeChecksum(bytes('123456789'), a).hex]),
    );

    assert.deepEqual(check, {
      adler32: '091E01DE',
      crc8: 'F4',
      'crc16-arc': 'BB3D',
      'crc16-ccitt-false': '29B1',
      'crc16-modbus': '4B37',
      crc32: 'CBF43926',
      crc32c: 'E3069283',
      fletcher16: '1EDE',
      fletcher32: 'DF09D509',
    });

    assert.equal(computeChecksum(bytes('abcde'), 'fletcher16').hex, 'C8F0');
    assert.equal(computeChecksum(bytes('abcdef'), 'fletcher16').hex, '2057');
    assert.equal(computeChecksum(bytes('abcde'), 'fletcher32').hex, 'F04FC729');
    assert.equal(computeChecksum(bytes('abcdef'), 'fletcher32').hex, '56502D2A');
    assert.equal(computeChecksum(bytes('Wikipedia'), 'adler32').hex, '11E60398');

    assert.deepEqual(computeChecksum(bytes('123456789'), 'crc32'), {
      decimal: 3421780262,
      hex: 'CBF43926',
    });
  });

  it('handles empty input and labels every algorithm', () => {
    assert.equal(computeChecksum(new Uint8Array(), 'crc32').hex, '00000000');
    assert.equal(computeChecksum(new Uint8Array(), 'adler32').hex, '00000001');
    assert.equal(computeChecksum(new Uint8Array(), 'crc16-ccitt-false').hex, 'FFFF');
    assert.equal(checksumAlgorithms.length, 9);

    assert.deepEqual(checksumAlgorithms.map(checksumLabel), [
      'CRC-32',
      'CRC-32C',
      'CRC-16/ARC',
      'CRC-16/CCITT-FALSE',
      'CRC-16/MODBUS',
      'CRC-8',
      'Adler-32',
      'Fletcher-16',
      'Fletcher-32',
    ]);
  });
});
